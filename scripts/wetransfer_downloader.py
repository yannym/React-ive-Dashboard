#!/usr/bin/env python3
"""
WeTransfer Background Downloader Script
Resolves direct email links (we.tl or wetransfer.com/downloads/...) and downloads files in background.
Outputs JSON progress logs to stdout for backend tracking.
"""

import sys
import os
import re
import time
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error
import zipfile

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

def log_json(data):
    print(json.dumps(data), flush=True)

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def resolve_url(url):
    """Follow redirects to find final wetransfer URL"""
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req) as response:
            return response.geturl()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            location = e.headers.get('Location')
            if location:
                if not location.startswith('http'):
                    location = urllib.parse.urljoin(url, location)
                return resolve_url(location)
        raise e

def parse_wetransfer_url(url):
    """
    Parses wetransfer URL to extract transfer_id, security_hash, recipient_id
    """
    final_url = resolve_url(url)
    log_json({"type": "info", "message": f"Resolved final URL: {final_url}"})

    # Pattern 1: wetransfer.com/downloads/{transfer_id}/{recipient_id}/{security_hash}
    m1 = re.search(r'wetransfer\.com/downloads/([a-zA-Z0-9]+)/([a-zA-Z0-9]+)/([a-zA-Z0-9]+)', final_url)
    if m1:
        return {
            'transfer_id': m1.group(1),
            'recipient_id': m1.group(2),
            'security_hash': m1.group(3),
            'url': final_url
        }

    # Pattern 2: wetransfer.com/downloads/{transfer_id}/{security_hash}
    m2 = re.search(r'wetransfer\.com/downloads/([a-zA-Z0-9]+)/([a-zA-Z0-9]+)', final_url)
    if m2:
        return {
            'transfer_id': m2.group(1),
            'recipient_id': None,
            'security_hash': m2.group(2),
            'url': final_url
        }

    raise ValueError(f"Could not parse valid WeTransfer parameters from URL: {final_url}")

def get_page_csrf_and_cookies(url):
    """Fetches download page HTML to extract CSRF token and cookies if required"""
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    })
    
    cookies = []
    csrf_token = None
    page_html = ""

    try:
        with urllib.request.urlopen(req) as resp:
            page_html = resp.read().decode('utf-8', errors='ignore')
            set_cookie = resp.headers.get_all('Set-Cookie') or []
            for c in set_cookie:
                cookies.append(c.split(';')[0])

            # Try to extract csrf-token meta tag
            csrf_m = re.search(r'name=["\']csrf-token["\']\s+content=["\']([^"\']+)["\']', page_html)
            if csrf_m:
                csrf_token = csrf_m.group(1)
    except Exception as e:
        log_json({"type": "warning", "message": f"Page cookie fetch warning: {e}"})

    return cookies, csrf_token, page_html

def request_direct_download_link(params, cookies, csrf_token, password=None):
    """Queries WeTransfer API for the direct download link"""
    transfer_id = params['transfer_id']
    security_hash = params['security_hash']
    recipient_id = params.get('recipient_id')

    api_url = f"https://wetransfer.com/api/v4/transfers/{transfer_id}/download"
    
    payload = {
        "intent": "entire_transfer",
        "security_hash": security_hash
    }
    if recipient_id:
        payload["recipient_id"] = recipient_id
    if password:
        payload["password"] = password

    json_data = json.dumps(payload).encode('utf-8')

    headers = {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*'
    }
    if cookies:
        headers['Cookie'] = "; ".join(cookies)
    if csrf_token:
        headers['x-csrf-token'] = csrf_token

    req = urllib.request.Request(api_url, data=json_data, headers=headers, method='POST')

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            log_json({"type": "info", "message": "Successfully obtained direct download URL from API v4"})
            return data.get('direct_link') or data.get('download_url')
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        log_json({"type": "warning", "message": f"API v4 request failed ({e.code}): {err_body}"})
        
        # Try prepare-download endpoint if standard download endpoint fails
        prep_url = f"https://wetransfer.com/api/v4/transfers/{transfer_id}/prepare-download"
        req_prep = urllib.request.Request(prep_url, data=json_data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req_prep) as resp_prep:
                data_prep = json.loads(resp_prep.read().decode('utf-8'))
                return data_prep.get('direct_link') or data_prep.get('download_url')
        except Exception as e2:
            log_json({"type": "error", "message": f"Prepare download fallback error: {e2}"})
            raise e

def download_file(direct_url, output_dir, unzip_after=False):
    """Downloads file with streaming progress reports"""
    os.makedirs(output_dir, exist_ok=True)

    req = urllib.request.Request(direct_url, headers={'User-Agent': USER_AGENT})
    
    with urllib.request.urlopen(req) as resp:
        content_disposition = resp.headers.get('Content-Disposition', '')
        file_name = 'wetransfer_download.zip'

        if 'filename=' in content_disposition:
            m = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';]+)["\']?', content_disposition)
            if m:
                file_name = urllib.parse.unquote(m.group(1))
        
        file_path = os.path.join(output_dir, file_name)
        total_size = int(resp.headers.get('Content-Length', 0))

        log_json({
            "type": "start",
            "file_name": file_name,
            "file_path": file_path,
            "total_bytes": total_size
        })

        downloaded = 0
        block_size = 64 * 1024  # 64 KB
        start_time = time.time()
        last_log_time = start_time

        with open(file_path, 'wb') as f:
            while True:
                buffer = resp.read(block_size)
                if not buffer:
                    break
                f.write(buffer)
                downloaded += len(buffer)
                
                now = time.time()
                # Log progress roughly every 0.3s or on completion
                if now - last_log_time >= 0.3 or downloaded == total_size:
                    elapsed = now - start_time
                    speed = downloaded / elapsed if elapsed > 0 else 0
                    eta = (total_size - downloaded) / speed if speed > 0 and total_size > 0 else 0
                    percent = round((downloaded / total_size) * 100, 1) if total_size > 0 else 0

                    log_json({
                        "type": "progress",
                        "downloaded": downloaded,
                        "total": total_size,
                        "percent": percent,
                        "speed_bytes_sec": round(speed),
                        "eta_seconds": round(eta, 1)
                    })
                    last_log_time = now

        log_json({
            "type": "complete",
            "file_name": file_name,
            "file_path": file_path,
            "total_bytes": downloaded,
            "duration_seconds": round(time.time() - start_time, 2)
        })

        if unzip_after and file_name.endswith('.zip'):
            try:
                extract_dir = os.path.splitext(file_path)[0]
                os.makedirs(extract_dir, exist_ok=True)
                log_json({"type": "info", "message": f"Unzipping contents into {extract_dir}..."})
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                log_json({"type": "unzip_complete", "extract_dir": extract_dir})
            except Exception as ze:
                log_json({"type": "warning", "message": f"Auto-unzip warning: {ze}"})

        return file_path

def main():
    parser = argparse.ArgumentParser(description="WeTransfer Downloader")
    parser.add_argument("url", help="WeTransfer link (we.tl or wetransfer.com/downloads/...)")
    parser.add_argument("--output", "-o", default="./downloads/wetransfer", help="Output directory")
    parser.add_argument("--password", "-p", default=None, help="Optional transfer password")
    parser.add_argument("--unzip", action="store_true", help="Automatically unzip .zip archives")

    args = parser.parse_args()

    try:
        log_json({"type": "status", "status": "resolving", "message": "Parsing and resolving WeTransfer link..."})
        params = parse_wetransfer_url(args.url)
        
        cookies, csrf_token, page_html = get_page_csrf_and_cookies(params['url'])
        
        log_json({"type": "status", "status": "requesting_link", "message": "Requesting direct download link from WeTransfer..."})
        direct_link = request_direct_download_link(params, cookies, csrf_token, password=args.password)

        if not direct_link:
            raise ValueError("No direct download URL returned by WeTransfer")

        log_json({"type": "status", "status": "downloading", "message": "Downloading file..."})
        download_file(direct_link, args.output, unzip_after=args.unzip)

    except Exception as e:
        log_json({"type": "error", "message": str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
