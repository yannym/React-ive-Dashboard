import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Mail, Phone, MapPin, Users, RefreshCw, FileDown, FileUp, 
  Settings, Plus, Trash2, Edit2, Play, Check, AlertCircle, Terminal, 
  ExternalLink, Code, Layers, Sparkles, Filter, Database, Calendar, 
  ChevronRight, Save, X, Info, Copy, ClipboardCheck, Lock, Sliders, 
  Map, HelpCircle, AlertTriangle, Sun, Moon, Send, Trash, ArrowUpDown, CheckSquare, Square
} from 'lucide-react';

const CITY_COORDINATES = {
  "bradenton, fl": [27.4989, -82.5748],
  "bradenton": [27.4989, -82.5748],
  "miami, fl": [25.7617, -80.1918],
  "miami": [25.7617, -80.1918],
  "sarasota, fl": [27.3364, -82.5307],
  "sarasota": [27.3364, -82.5307],
  "sarasota courthouse": [27.3364, -82.5307],
  "tampa, fl": [27.9506, -82.4572],
  "tampa": [27.9506, -82.4572],
  "san francisco, ca": [37.7749, -122.4194],
  "san francisco": [37.7749, -122.4194],
  "new york, ny": [40.7128, -74.0060],
  "new york": [40.7128, -74.0060],
  "brooklyn, ny": [40.6782, -73.9442],
  "boston, ma": [42.3601, -71.0589],
  "boston": [42.3601, -71.0589],
  "austin, tx": [30.2672, -97.7431],
  "austin": [30.2672, -97.7431],
  "portland, or": [45.5152, -122.6784],
  "portland": [45.5152, -122.6784],
  "chicago, il": [41.8781, -87.6298],
  "chicago": [41.8781, -87.6298],
  "seattle, wa": [47.6062, -122.3321],
  "seattle": [47.6062, -122.3321],
  "santa fe, nm": [35.6870, -105.9378]
};

const AREA_CODE_COORDINATES = {
  "941": { coords: [27.4989, -82.5748], name: "Bradenton/Sarasota, FL" },
  "305": { coords: [25.7617, -80.1918], name: "Miami, FL" },
  "786": { coords: [25.7617, -80.1918], name: "Miami, FL" },
  "813": { coords: [27.9506, -82.4572], name: "Tampa, FL" },
  "415": { coords: [37.7749, -122.4194], name: "San Francisco, CA" },
  "628": { coords: [37.7749, -122.4194], name: "San Francisco, CA" },
  "212": { coords: [40.7128, -74.0060], name: "New York City, NY" },
  "718": { coords: [40.7128, -74.0060], name: "New York City, NY" },
  "917": { coords: [40.7128, -74.0060], name: "New York City, NY" },
  "617": { coords: [42.3601, -71.0589], name: "Boston, MA" },
  "857": { coords: [42.3601, -71.0589], name: "Boston, MA" },
  "512": { coords: [30.2672, -97.7431], name: "Austin, TX" },
  "737": { coords: [30.2672, -97.7431], name: "Austin, TX" },
  "206": { coords: [47.6062, -122.3321], name: "Seattle, WA" },
  "503": { coords: [45.5152, -122.6784], name: "Portland, OR" },
  "971": { coords: [45.5152, -122.6784], name: "Portland, OR" },
  "312": { coords: [41.8781, -87.6298], name: "Chicago, IL" },
  "773": { coords: [41.8781, -87.6298], name: "Chicago, IL" }
};

const ZIP_COORDINATES_REGISTRY = {
  "34231": { coords: [27.2693, -82.5057], name: "Sarasota, FL" },
  "34236": { coords: [27.3364, -82.5307], name: "Sarasota, FL" },
  "34205": { coords: [27.4989, -82.5748], name: "Bradenton, FL" },
  "33139": { coords: [25.7781, -80.1313], name: "Miami Beach, FL" },
  "33101": { coords: [25.7743, -80.1937], name: "Miami, FL" },
  "33602": { coords: [27.9506, -82.4572], name: "Tampa, FL" },
  "10001": { coords: [40.7501, -73.9963], name: "New York, NY" },
  "90210": { coords: [34.1030, -118.4105], name: "Los Angeles, CA" },
  "94102": { coords: [37.7749, -122.4194], name: "San Francisco, CA" },
  "60601": { coords: [41.8781, -87.6298], name: "Chicago, IL" },
  "02108": { coords: [42.3601, -71.0589], name: "Boston, MA" },
  "78701": { coords: [30.2672, -97.7431], name: "Austin, TX" },
  "98101": { coords: [47.6062, -122.3321], name: "Seattle, WA" },
  "97201": { coords: [45.5152, -122.6784], name: "Portland, OR" },
  "87501": { coords: [35.6870, -105.9378], name: "Santa Fe, NM" }
};

const INITIAL_CLIENTS = [
  {
    id: "hb-1",
    name: "Eleanor Sterling",
    email: "eleanor.sterling@example.com",
    phone: "(305) 555-0143",
    location: "Miami, FL",
    partner: "Thomas Sterling",
    summary: "HoneyBook Inquiry regarding a high-end wedding design coordination package for October 2027 at Vizcaya Gardens.",
    notes: "Requires a quote on floristry inclusions. Preferred communication via email.",
    receivedAt: "2026-06-12T14:32:00.000Z",
    source: "HoneyBook (mailman@honeybook.com)"
  },
  {
    id: "hb-2",
    name: "Marcus Vance",
    email: "marcus.vance@vancetech.io",
    phone: "415-555-8921",
    location: "San Francisco, CA",
    partner: "Sienna Vance",
    summary: "Winery wedding ceremony shoot planned with couples photography, asking for localized logistics.",
    notes: "Follow up in early July about local caterer recommendations.",
    receivedAt: "2026-06-15T09:15:00.000Z",
    source: "HoneyBook (mailman@honeybook.com)"
  },
  {
    id: "hb-3",
    name: "Clara Jenkins",
    email: "clara.j@jenkinslaw.com",
    phone: "941-555-0198",
    location: "Sarasota Courthouse",
    partner: "Julian Jenkins",
    summary: "We need an elegant couples coordination timeline setup for our upcoming celebration shoot at the Sarasota Courthouse.",
    notes: "Wants courthouse architecture prominently featured.",
    receivedAt: "2026-06-14T18:45:00.000Z",
    source: "HoneyBook (mailman@honeybook.com)"
  },
  {
    id: "hb-4",
    name: "Davis Family Group",
    email: "davis.clan@familymail.com",
    phone: "941-555-9011",
    location: "Bradenton, FL",
    partner: "None",
    summary: "Seeking a localized premium outdoor family portrait collection around local beaches.",
    notes: "Sunset slot requested. 6 family members expected.",
    receivedAt: "2026-06-10T11:05:00.000Z",
    source: "HoneyBook (mailman@honeybook.com)"
  }
];

const geocodeHeuristically = (locationStr) => {
  if (!locationStr) return null;
  const clean = locationStr.toLowerCase().trim();
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (clean.includes(city) || city.includes(clean)) {
      return coords;
    }
  }
  return null;
};

const inferLocationFromNarrative = (summaryText, nameText = "", phoneText = "") => {
  const combined = ((summaryText || "") + " " + (nameText || "")).toLowerCase();
  
  if (combined.includes("bradenton")) {
    return { locationName: "Bradenton, FL (Best Guess)", coords: CITY_COORDINATES["bradenton"] };
  }
  if (combined.includes("sarasota courthouse") || combined.includes("sarasota")) {
    return { locationName: "Sarasota, FL (Best Guess)", coords: CITY_COORDINATES["sarasota"] };
  }
  if (combined.includes("tampa")) {
    return { locationName: "Tampa, FL (Best Guess)", coords: CITY_COORDINATES["tampa"] };
  }
  if (combined.includes("miami") || combined.includes("vizcaya")) {
    return { locationName: "Miami, FL (Best Guess)", coords: CITY_COORDINATES["miami"] };
  }
  if (combined.includes("san francisco") || combined.includes("bay area")) {
    return { locationName: "San Francisco, CA (Best Guess)", coords: CITY_COORDINATES["san francisco"] };
  }
  if (combined.includes("new york") || combined.includes("brooklyn") || combined.includes("nyc")) {
    return { locationName: "New York, NY (Best Guess)", coords: CITY_COORDINATES["new york"] };
  }

  if (phoneText) {
    const cleanedPhone = phoneText.replace(/\D/g, '');
    let areaCode = "";
    if (cleanedPhone.length === 10) {
      areaCode = cleanedPhone.substring(0, 3);
    } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
      areaCode = cleanedPhone.substring(1, 4);
    }
    if (areaCode && AREA_CODE_COORDINATES[areaCode]) {
      const match = AREA_CODE_COORDINATES[areaCode];
      return {
        locationName: `${match.name} (Phone Guess)`,
        coords: match.coords
      };
    }
  }
  return null;
};

const calculateDistanceInMiles = (coords1, coords2) => {
  if (!coords1 || !coords2) return null;
  const [lat1, lon1] = coords1;
  const [lat2, lon2] = coords2;
  const R = 3958.8; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const APPS_SCRIPT_CODE_V2 = `/**
 * InquireFlow V3 - HoneyBook Gmail Extractor & Sync Gateway
 * Batched Pagination Engine (No Execution Timeout)
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : "recent";
  const customDays = e && e.parameter && e.parameter.days ? parseInt(e.parameter.days) : 30;
  
  // High-precision inquiry specific target filter
  const searchQuery = 'subject:"New Inquiry Added" honeybook.com';

  let maxThreadsToScan = 1000;
  if (action === "full") {
    maxThreadsToScan = 4000; // Complete 5-Year Sync cap safely paginated
  }

  const batchSize = 100;
  let startOffset = 0;
  const extractedLeads = [];

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - (customDays * millisecondsPerDay));

  try {
    while (startOffset < maxThreadsToScan) {
      const threads = GmailApp.search(searchQuery, startOffset, batchSize);
      if (threads.length === 0) break;

      for (let i = 0; i < threads.length; i++) {
        const messages = threads[i].getMessages();
        for (let j = 0; j < messages.length; j++) {
          const message = messages[j];
          const date = message.getDate();

          if (action !== "full" && date < cutoffDate) {
            continue; // Skip messages outside range
          }

          const body = message.getPlainBody();
          const subject = message.getSubject();

          const data = parseHoneyBookEmailText(body, subject);
          if (data) {
            data.id = "hb-" + message.getId();
            data.receivedAt = date.toISOString();
            extractedLeads.push(data);
          }
        }
      }
      startOffset += batchSize;
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    count: extractedLeads.length,
    data: extractedLeads
  })).setMimeType(ContentService.MimeType.JSON);
}

function parseHoneyBookEmailText(body, subject) {
  const cleanBody = body.replace(/<[^>]*>/g, ' ');
  const cleanSubject = subject || "";
  const cleanSubjLower = cleanSubject.toLowerCase();

  // Strict gating verify
  if (cleanSubjLower.indexOf("new inquiry added") === -1) {
    return null;
  }

  const data = {
    name: "",
    email: "",
    phone: "",
    location: "Not Specified",
    partner: "Not Specified",
    summary: "",
    notes: ""
  };

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/gi;
  const emailMatch = cleanBody.match(emailRegex);
  if (emailMatch) {
    const filterMail = emailMatch.find(m => !m.toLowerCase().includes("mailman") && !m.toLowerCase().includes("noreply"));
    if (filterMail) data.email = filterMail;
  }

  const phoneRegex = /(?:\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}/g;
  const phoneMatch = cleanBody.match(phoneRegex);
  if (phoneMatch) {
    data.phone = phoneMatch[0].trim();
  }

  // Strict local single-line name query to fix "Your" suffix capture
  const nameMatch = cleanBody.match(/(?:Client Name|Name|Contact|From|Inquirer):[ \\t]*([A-Za-z]+(?:[ \\t]+[A-Za-z]+){1,2})/i);
  if (nameMatch && nameMatch[1]) {
    data.name = nameMatch[1].trim();
  }

  if (!data.name || data.name.toLowerCase().indexOf("unknown") !== -1 || data.name.trim() === "") {
    return null;
  }

  const locationMatch = cleanBody.match(/(?:Location|City|Venue|Address|Area|Event Location|Planned location\\/venue|Planned location):[ \\t]*([A-Za-z0-9\\s,.-]+?)(?:\\r?\\n|$)/i);
  if (locationMatch && locationMatch[1]) {
    data.location = locationMatch[1].trim().replace(/\\s+/g, ' ');
  }

  const messageMatch = cleanBody.match(/(?:Inquiry|Message|Details|Comments|Notes|Description):\\s*([\\s\\S]+?)(?:\\r?\\n\\r?\\n|$)/i);
  if (messageMatch && messageMatch[1]) {
    data.summary = messageMatch[1].trim().replace(/\\s+/g, ' ');
  } else {
    data.summary = "New HoneyBook automated inquiry.";
  }

  return data;
}`;

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('inquireflow_theme') || 'dark';
  });

  const [clients, setClients] = useState(() => {
    const saved = localStorage.getItem('inquireflow_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [activeTab, setActiveTab] = useState('database'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [sortBy, setSortBy] = useState('date-newest'); 

  // Multi-select States
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastClickedId, setLastClickedId] = useState(null);

  // Interactive Filter States
  const [stateFilter, setStateFilter] = useState('ALL'); // ALL, FL, CA, NY, OTHER
  const [typeFilter, setTypeFilter] = useState('ALL');   // ALL, WEDDING, COUPLES, FAMILY

  // Density Scaling Slider
  const [cardDensity, setCardDensity] = useState(() => {
    const savedDensity = localStorage.getItem('inquireflow_density');
    return savedDensity ? parseFloat(savedDensity) : 0.95;
  });

  // Secure PIN logic
  const [masterPin, setMasterPin] = useState(() => {
    return localStorage.getItem('inquireflow_master_pin') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !localStorage.getItem('inquireflow_master_pin');
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSetupInput, setPinSetupInput] = useState('');

  // Business Hub Configuration
  const [userZip, setUserZip] = useState(() => {
    return localStorage.getItem('inquireflow_user_zip') || '34236'; 
  });
  const [userCoords, setUserCoords] = useState(() => {
    const savedCoords = localStorage.getItem('inquireflow_user_coords');
    return savedCoords ? JSON.parse(savedCoords) : [27.3364, -82.5307];
  });
  const [userLocationName, setUserLocationName] = useState(() => {
    return localStorage.getItem('inquireflow_user_loc_name') || 'Sarasota, FL';
  });
  const [resolvingZip, setResolvingZip] = useState(false);

  // Sync window parameter details (7, 14, 30, 90, 365, 1825 days)
  const [refreshDays, setRefreshDays] = useState(30);

  // Deep Scan state vectors
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  // Logs terminal variables
  const [syncLogs, setSyncLogs] = useState(() => {
    const saved = localStorage.getItem('inquireflow_sync_logs');
    return saved ? JSON.parse(saved) : [`[${new Date().toLocaleTimeString()}] [SYSTEM] InquireFlow V3 parser ready.`];
  });
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);
  const [syncStatus, setSyncStatus] = useState('disconnected'); 

  // Apps Script integration credentials
  const [appsScriptUrl, setAppsScriptUrl] = useState(() => {
    return localStorage.getItem('inquireflow_gas_url') || '';
  });

  // Sandbox simulation structures
  const [sandboxEmailSubject, setSandboxEmailSubject] = useState("New Inquiry Added: Wedding coordinate timeline");
  const [sandboxEmailBody, setSandboxEmailBody] = useState(
    `Sender: mailman@honeybook.com\n\nClient Name: Amelia Vance\nPhone Contact: (941) 555-0199\nEmail: amelia.vance@example.com\nPlanned location/venue: Sarasota Courthouse\n\nInquiry Message: We need coastal wedding support at the Sarasota Courthouse details. Hit me back!`
  );
  const [parsedSandboxData, setParsedSandboxData] = useState(null);
  const [sandboxAdded, setSandboxAdded] = useState(false);

  // Manual client intake properties
  const [isEditing, setIsEditing] = useState(false);
  const [editClientData, setEditClientData] = useState(null);

  // Leaflet map hooks
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerGroupRef = useRef(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (!isAuthenticated && masterPin) {
          e.preventDefault();
          const targetBtn = document.getElementById('security-pin-btn');
          if (targetBtn) targetBtn.click();
        }
        else if (confirmModal.isOpen) {
          e.preventDefault();
          const confirmBtn = document.getElementById('modal-action-confirm-btn');
          if (confirmBtn) confirmBtn.click();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAuthenticated, masterPin, confirmModal.isOpen]);

  useEffect(() => {
    if (clients && clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0]);
    }
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('inquireflow_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('inquireflow_density', cardDensity.toString());
  }, [cardDensity]);

  useEffect(() => {
    localStorage.setItem('inquireflow_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('inquireflow_sync_logs', JSON.stringify(syncLogs));
  }, [syncLogs]);

  useEffect(() => {
    const cleanBody = sandboxEmailBody.replace(/<[^>]*>/g, ' '); 
    const cleanSubject = sandboxEmailSubject.trim();
    const cleanBodyLower = cleanBody.toLowerCase();
    const cleanSubjLower = cleanSubject.toLowerCase();

    if (cleanSubjLower.includes("new inquiry added")) {
      const data = {
        name: "",
        email: "",
        phone: "",
        location: "Not Specified",
        partner: "Not Specified",
        summary: "",
        notes: ""
      };

      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      const emailMatch = cleanBody.match(emailRegex);
      if (emailMatch) {
        const filtered = emailMatch.find(m => !m.toLowerCase().includes("mailman") && !m.toLowerCase().includes("noreply"));
        if (filtered) data.email = filtered;
      }

      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const phoneMatch = cleanBody.match(phoneRegex);
      if (phoneMatch) {
        data.phone = phoneMatch[0].trim();
      }

      const nameMatch = cleanBody.match(/(?:Client Name|Name|Contact|From|Inquirer):[ \t]*([A-Za-z]+(?:[ \t]+[A-Za-z]+){1,2})/i);
      if (nameMatch && nameMatch[1]) {
        data.name = nameMatch[1].trim();
      }

      const locationMatch = cleanBody.match(/(?:Location|City|Venue|Address|Area|Event Location|Planned location\/venue|Planned location):[ \t]*([A-Za-z0-9\s,.-]+?)(?:\r?\n|$)/i);
      if (locationMatch && locationMatch[1]) {
        data.location = locationMatch[1].trim();
      }

      const msgMatch = cleanBody.match(/(?:Inquiry Details|Message|Details|Comments|Notes|Description):\s*([\s\S]+?)(?:\r?\n\r?\n|$)/i);
      if (msgMatch && msgMatch[1]) {
        data.summary = msgMatch[1].trim();
      } else {
        data.summary = cleanBody.substring(0, 200) + "...";
      }

      if (data.name) {
        setParsedSandboxData(data);
      } else {
        setParsedSandboxData(null);
      }
    } else {
      setParsedSandboxData(null);
    }
    setSandboxAdded(false);
  }, [sandboxEmailBody, sandboxEmailSubject]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncLogs(prev => [`[${timestamp}] [${type.toUpperCase()}] ${message}`, ...prev]);
  };

  const handleResolveZipCode = async (zipToSearch) => {
    if (!zipToSearch || zipToSearch.trim() === '') return;
    setResolvingZip(true);
    addLog(`Resolving coordinates for ZIP Code: ${zipToSearch}...`, 'info');

    if (ZIP_COORDINATES_REGISTRY[zipToSearch]) {
      const matched = ZIP_COORDINATES_REGISTRY[zipToSearch];
      setUserCoords(matched.coords);
      setUserLocationName(matched.name);
      localStorage.setItem('inquireflow_user_zip', zipToSearch);
      localStorage.setItem('inquireflow_user_coords', JSON.stringify(matched.coords));
      localStorage.setItem('inquireflow_user_loc_name', matched.name);
      addLog(`Resolved locally: ${matched.name} (${matched.coords.join(', ')})`, 'success');
      setResolvingZip(false);
      return;
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${zipToSearch}&country=USA&format=json`);
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const coords = [lat, lon];
        let dName = data[0].display_name.split(',')[0] + ", USA";
        
        setUserCoords(coords);
        setUserLocationName(dName);
        localStorage.setItem('inquireflow_user_zip', zipToSearch);
        localStorage.setItem('inquireflow_user_coords', JSON.stringify(coords));
        localStorage.setItem('inquireflow_user_loc_name', dName);
        addLog(`Resolved online: ${dName} (${coords.join(', ')})`, 'success');
      } else {
        addLog(`Could not geocode ZIP ${zipToSearch} securely.`, 'warning');
      }
    } catch (e) {
      addLog(`Geocoding request failed: ${e.message}`, 'danger');
    } finally {
      setResolvingZip(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'map' || mapLoaded) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setMapLoaded(true);
    };
    document.body.appendChild(script);
  }, [activeTab, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || activeTab !== 'map' || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    mapInstanceRef.current = L.map(mapContainerRef.current, {
      center: userCoords || [27.3364, -82.5307], 
      zoom: 9,
      zoomControl: true
    });

    const tileUrl = theme === 'dark' 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstanceRef.current);

    markerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    if (userCoords) {
      const userIcon = L.divIcon({
        html: `<div class="w-6 h-6 rounded-full bg-rose-650 border-2 border-white ring-4 ring-rose-500/25 flex items-center justify-center text-[10px] font-black text-white shadow-lg">★</div>`,
        className: 'user-leaflet-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker(userCoords, { icon: userIcon })
        .bindPopup(`
          <div class="p-1 rounded text-xs text-slate-900">
            <strong class="text-rose-600 font-extrabold">📍 Registered Hub Center</strong>
            <p class="text-[10px] text-slate-500 font-medium mt-0.5">${userLocationName} (${userZip})</p>
          </div>
        `)
        .addTo(markerGroupRef.current);
    }

    clients.forEach((client) => {
      let coords = null;
      let isBestGuess = false;
      let displayLocation = client.location;

      if (client.location && client.location !== 'Not Specified') {
        coords = geocodeHeuristically(client.location);
      } else {
        const guess = inferLocationFromNarrative(client.summary, client.name, client.phone);
        if (guess) {
          coords = guess.coords;
          displayLocation = guess.locationName;
          isBestGuess = true;
        }
      }

      if (coords) {
        const pinColor = isBestGuess ? "bg-amber-500" : "bg-indigo-600";
        const svgIcon = L.divIcon({
          html: `<div class="w-5 h-5 rounded-full border-2 border-white ring-4 ring-slate-400/20 ${pinColor} flex items-center justify-center text-[9px] font-black text-white shadow-md">♥</div>`,
          className: 'custom-leaflet-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const popupThemeClass = theme === 'dark' ? 'text-slate-100 bg-slate-900' : 'text-slate-900 bg-white';

        const marker = L.marker(coords, { icon: svgIcon })
          .bindPopup(`
            <div class="${popupThemeClass} p-2 rounded max-w-xs text-xs">
              <h4 class="font-bold text-indigo-600 dark:text-indigo-400">${client.name}</h4>
              <p class="font-semibold flex items-center gap-1 mt-1 text-[11px]">📍 ${displayLocation}</p>
              ${isBestGuess ? `
                <div class="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-500 font-extrabold px-2 py-0.5 rounded mt-1.5 inline-flex items-center gap-1 border border-amber-500/30">
                  ⚠️ Advanced Inference
                </div>
              ` : ''}
              <div class="text-[10px] mt-2 italic p-1.5 rounded bg-slate-500/10 leading-tight">
                "${client.summary ? client.summary.substring(0, 85) : ''}..."
              </div>
            </div>
          `);
        
        markerGroupRef.current.addLayer(marker);
      }
    });

  }, [mapLoaded, activeTab, clients, theme, userCoords, userZip, userLocationName]);

  const getClientCoords = (client) => {
    if (client.location && client.location !== "Not Specified") {
      return geocodeHeuristically(client.location);
    }
    const guess = inferLocationFromNarrative(client.summary, client.name, client.phone);
    return guess ? guess.coords : null;
  };

  const getClientState = (client) => {
    let loc = (client.location || '').toLowerCase();
    if (loc === 'not specified' || !loc) {
      const guess = inferLocationFromNarrative(client.summary, client.name, client.phone);
      loc = guess ? guess.locationName.toLowerCase() : '';
    }
    if (loc.includes('fl') || loc.includes('florida') || loc.includes('sarasota') || loc.includes('bradenton') || loc.includes('tampa') || loc.includes('miami')) return 'FL';
    if (loc.includes('ca') || loc.includes('california') || loc.includes('san francisco')) return 'CA';
    if (loc.includes('ny') || loc.includes('new york') || loc.includes('brooklyn')) return 'NY';
    return 'OTHER';
  };

  const getClientInquiryType = (client) => {
    const text = ((client.summary || '') + ' ' + (client.name || '')).toLowerCase();
    if (text.includes('wedding') || text.includes('ceremony') || text.includes('marriage') || text.includes('bride')) return 'WEDDING';
    if (text.includes('couple') || text.includes('engagement') || text.includes('shoot') || text.includes('proposal')) return 'COUPLES';
    if (text.includes('family') || text.includes('portrait') || text.includes('maternity') || text.includes('kids')) return 'FAMILY';
    return 'WEDDING'; // Default fallback
  };

  const sortedAndFilteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = [...clients];

    // Text query filters
    if (q) {
      result = result.filter(c => 
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
      );
    }

    // State filtering logic
    if (stateFilter !== 'ALL') {
      result = result.filter(c => getClientState(c) === stateFilter);
    }

    // Inquiry Type segment filtering logic
    if (typeFilter !== 'ALL') {
      result = result.filter(c => getClientInquiryType(c) === typeFilter);
    }

    // Advanced sorting logic
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-az':
          return (a.name || '').localeCompare(b.name || '');
        case 'name-za':
          return (b.name || '').localeCompare(a.name || '');
        case 'date-oldest':
          return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
        case 'distance-near':
          const distA = calculateDistanceInMiles(userCoords, getClientCoords(a)) ?? Infinity;
          const distB = calculateDistanceInMiles(userCoords, getClientCoords(b)) ?? Infinity;
          return distA - distB;
        case 'date-newest':
        default:
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
      }
    });

    return result;
  }, [clients, searchQuery, sortBy, stateFilter, typeFilter, userCoords]);

  const handleCardClick = (client, event) => {
    const sortedIds = sortedAndFilteredClients.map(c => c.id);
    let newSelected = new Set(selectedIds);

    if (event.shiftKey && lastClickedId && sortedIds.includes(lastClickedId)) {
      // Shift Click: Range select
      const startIdx = sortedIds.indexOf(lastClickedId);
      const endIdx = sortedIds.indexOf(client.id);
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      
      const rangeIds = sortedIds.slice(minIdx, maxIdx + 1);
      
      if (!event.ctrlKey && !event.metaKey) {
        newSelected = new Set(rangeIds);
      } else {
        rangeIds.forEach(id => newSelected.add(id));
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd Click: Toggle selection
      if (newSelected.has(client.id)) {
        newSelected.delete(client.id);
      } else {
        newSelected.add(client.id);
      }
      setLastClickedId(client.id);
    } else {
      // Regular Click: Single select
      newSelected = new Set([client.id]);
      setSelectedClient(client);
      setLastClickedId(client.id);
    }

    setSelectedIds(newSelected);
    
    // Auto-sync Inspector view with single item selects
    if (newSelected.size === 1) {
      const singleId = Array.from(newSelected)[0];
      const singleClient = clients.find(c => c.id === singleId);
      if (singleClient) setSelectedClient(singleClient);
    } else if (newSelected.size === 0) {
      setSelectedClient(null);
    }
  };

  const handleUpdateNotes = (clientId, newNotes) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, notes: newNotes } : c));
    if (selectedClient && selectedClient.id === clientId) {
      setSelectedClient(prev => ({ ...prev, notes: newNotes }));
    }
  };

  // Dynamic grid layouts derived strictly from density selector
  const gridLayoutClass = useMemo(() => {
    if (cardDensity < 0.85) {
      return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
    } else if (cardDensity >= 0.85 && cardDensity <= 1.05) {
      return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
    } else {
      return "grid-cols-1 xl:grid-cols-2";
    }
  }, [cardDensity]);

  const totalClients = clients.length;

  const mappedCount = useMemo(() => {
    return clients.filter(c => {
      if (c.location && c.location !== "Not Specified") return true;
      const guess = inferLocationFromNarrative(c.summary, c.name, c.phone);
      return guess !== null;
    }).length;
  }, [clients]);

  const triggerScan = async (type) => {
    if (isScanning) return; 
    setIsScanning(true);
    setScanProgress(10);
    
    addLog(`Scanning Gmail database in batches... [Sync Window: ${refreshDays} Days]`, 'info');

    const progressTimer = setInterval(() => {
      setScanProgress(p => {
        if (p >= 90) return p;
        return p + Math.floor(Math.random() * 15) + 1;
      });
    }, 350);

    if (!appsScriptUrl) {
      setTimeout(() => {
        clearInterval(progressTimer);
        setScanProgress(100);
        
        const updateArray = [...clients];
        const dummyInquiry = {
          id: "sim-hb-" + Math.random().toString(36).substr(2, 9),
          name: "Amelia Vance",
          email: "amelia.vance@example.com",
          phone: "941-555-0199",
          location: "Sarasota Courthouse",
          partner: "Not Specified",
          summary: "We want to shoot an elegant wedding sequence at the historic Sarasota Courthouse. Let us know your coordinates!",
          notes: "Sandbox notes default string.",
          receivedAt: new Date().toISOString(),
          source: "HoneyBook Simulator"
        };
        
        if (!updateArray.some(c => c.email.toLowerCase() === dummyInquiry.email.toLowerCase())) {
          updateArray.unshift(dummyInquiry);
          setClients(updateArray);
          addLog(`Simulated: Ingested inquiry for ${dummyInquiry.name}`, "success");
        }
        
        setIsScanning(false);
      }, 1500);

    } else {
      try {
        clearInterval(progressTimer);
        setScanProgress(40);
        
        const queryUrl = `${appsScriptUrl}?action=${type}&days=${refreshDays}`;
        const response = await fetch(queryUrl);
        setScanProgress(70);
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const resultPayload = await response.json();
        setScanProgress(90);

        if (resultPayload && resultPayload.success && Array.isArray(resultPayload.data)) {
          let addedCount = 0;
          const updatedClients = [...clients];

          resultPayload.data.forEach(item => {
            const exists = updatedClients.some(c => c.email.toLowerCase() === item.email.toLowerCase());
            if (!exists) {
              updatedClients.unshift({
                id: item.id || "live-hb-" + Math.random().toString(36).substr(2, 9),
                name: item.name,
                email: item.email || "",
                phone: item.phone || "",
                location: item.location || "Not Specified",
                partner: item.partner || "Not Specified",
                summary: item.summary || "No details provided.",
                notes: "",
                receivedAt: item.receivedAt || new Date().toISOString(),
                source: "HoneyBook Live Gateway"
              });
              addedCount++;
            }
          });

          setClients(updatedClients);
          setSyncStatus('live');
          setScanProgress(100);
          addLog(`Sync complete! Loaded ${addedCount} new client leads.`, "success");
        }
      } catch (err) {
        addLog(`Connection error: ${err.message}`, "danger");
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Confirm Deleting ${selectedIds.size} Cards?`,
      message: `Are you sure you want to permanently delete the ${selectedIds.size} selected cards? This action cannot be undone.`,
      confirmText: `Delete ${selectedIds.size} Leads`,
      cancelText: "Cancel",
      onConfirm: () => {
        const remaining = clients.filter(c => !selectedIds.has(c.id));
        setClients(remaining);
        setSelectedIds(new Set());
        setSelectedClient(remaining[0] || null);
        addLog(`Bulk deleted ${selectedIds.size} cards.`, "warning");
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBulkCopyEmails = () => {
    if (selectedIds.size === 0) return;
    const emails = clients
      .filter(c => selectedIds.has(c.id) && c.email)
      .map(c => c.email)
      .join(', ');
    
    if (!emails) {
      addLog("No valid email addresses found in selection.", "warning");
      return;
    }

    const ta = document.createElement("textarea");
    ta.value = emails;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    addLog(`Copied ${selectedIds.size} email addresses to clipboard.`, "success");
  };

  const handlePurgeSandboxData = () => {
    setConfirmModal({
      isOpen: true,
      title: "Confirm Purging Sandbox Data?",
      message: "This will immediately remove all simulation data and manually ingested sandbox cards. Real inquiries will remain.",
      confirmText: "Erase Sandbox Leads",
      cancelText: "Cancel",
      onConfirm: () => {
        const productionOnly = clients.filter(c => !c.id.startsWith("sim-") && !c.id.startsWith("manual-hb-") && !c.id.startsWith("manual-intake-"));
        setClients(productionOnly);
        setSelectedIds(new Set());
        setSelectedClient(productionOnly[0] || null);
        addLog("Sandbox records successfully purged.", "info");
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteClient = (id) => {
    const target = clients.find(c => c.id === id);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: "Confirm Deletion?",
      message: `Are you sure you want to permanently delete ${target.name}? This card will be removed locally.`,
      confirmText: "Delete Client",
      cancelText: "Cancel",
      onConfirm: () => {
        const remaining = clients.filter(c => c.id !== id);
        setClients(remaining);
        const updatedSelected = new Set(selectedIds);
        updatedSelected.delete(id);
        setSelectedIds(updatedSelected);
        if (selectedClient?.id === id) {
          setSelectedClient(remaining[0] || null);
        }
        addLog(`Erased card profile: ${target.name}`, "warning");
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveClient = (e) => {
    e.preventDefault();
    if (editClientData.id) {
      setClients(clients.map(c => c.id === editClientData.id ? editClientData : c));
      addLog(`Updated: ${editClientData.name}`, "info");
      if (selectedClient?.id === editClientData.id) setSelectedClient(editClientData);
    } else {
      const newC = {
        ...editClientData,
        id: "manual-intake-" + Math.random().toString(36).substr(2, 9),
        receivedAt: new Date().toISOString(),
        source: "Manual Intake Card"
      };
      setClients([newC, ...clients]);
      setSelectedClient(newC);
      addLog(`Created Custom Card: ${newC.name}`, "success");
    }
    setIsEditing(false);
    setEditClientData(null);
  };

  const startNewClientForm = () => {
    setEditClientData({
      name: "",
      email: "",
      phone: "",
      location: "",
      partner: "",
      summary: "",
      notes: ""
    });
    setIsEditing(true);
  };

  const startEditClientForm = (client) => {
    setEditClientData({ ...client });
    setIsEditing(true);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === masterPin) {
      setIsAuthenticated(true);
      setPinError('');
      addLog("Workspace authorized successfully.", "success");
    } else {
      setPinError("Invalid Master PIN code.");
      setPinInput('');
    }
  };

  const handleSetupPin = (e) => {
    e.preventDefault();
    if (pinSetupInput.length >= 4) {
      localStorage.setItem('inquireflow_master_pin', pinSetupInput);
      setMasterPin(pinSetupInput);
      setIsAuthenticated(true);
      addLog("Initial passcode protocol initialized.", "success");
    } else {
      setPinError("PIN must be 4+ digits.");
    }
  };

  const themeBg = theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const headerBg = theme === 'dark' ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const cardBg = theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const innerCardBg = theme === 'dark' ? 'bg-slate-950 border-slate-800/80 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800';
  const inputStyle = "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500";

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${themeBg}`}>
        {!masterPin ? (
          <div className={`${cardBg} border p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500"></div>
            <div className="text-center space-y-2">
              <Lock className="w-10 h-10 mx-auto text-indigo-400" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Configure Master Security PIN</h2>
              <p className="text-xs opacity-70 font-medium">Initialize passcode logic to protect client directories.</p>
            </div>
            <form onSubmit={handleSetupPin} className="space-y-4">
              <input 
                type="password"
                placeholder="••••"
                value={pinSetupInput}
                onChange={(e) => setPinSetupInput(e.target.value.replace(/\D/g, ''))}
                className={`w-full text-center text-xl tracking-widest rounded-xl p-3 ${inputStyle}`}
                required
              />
              <button type="submit" className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-550 text-white text-xs font-bold rounded-xl shadow-lg transition-colors">
                Activate Secure Code
              </button>
            </form>
          </div>
        ) : (
          <div className={`${cardBg} border p-8 rounded-2xl max-w-sm w-full space-y-6 shadow-2xl relative`}>
            <div className="text-center space-y-2">
              <Lock className="w-10 h-10 mx-auto text-indigo-400" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white font-black">Authentication Required</h2>
            </div>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input 
                type="password"
                placeholder="••••"
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                className={`w-full text-center text-2xl tracking-widest rounded-xl p-3 ${inputStyle}`}
                required
              />
              {pinError && <p className="text-[11px] text-rose-500 text-center font-bold">{pinError}</p>}
              <button id="security-pin-btn" type="submit" className="w-full py-2.5 bg-indigo-655 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg transition-colors">
                Unlock Workspace
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-300 font-sans pb-24 ${themeBg}`}>
      
      {/* Top Background Scan Banner */}
      {isScanning && (
        <div className="w-full bg-indigo-650 text-white sticky top-0 z-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4 text-xs font-bold">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>Scanning Gmail database in batches...</span>
            </div>
            <div className="flex items-center gap-4 flex-1 max-w-xs">
              <div className="w-full bg-indigo-900/40 h-2 rounded-full overflow-hidden">
                <div className="bg-white h-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
              </div>
              <span className="font-mono shrink-0">{scanProgress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION with bright, visible Logo elements */}
      <header className={`border-b sticky top-0 z-45 backdrop-blur-md ${headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col lg:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-650 to-indigo-550 rounded-xl shadow-md">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {/* Ultra high-contrast gradient text ensures visibility against both light and dark header bars */}
                <h1 className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                  InquireFlow V3
                </h1>
                <span className="text-[9px] bg-indigo-500/15 border border-indigo-500/20 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">Client Parser</span>
              </div>
              <p className="text-[10px] opacity-70 font-semibold text-slate-600 dark:text-slate-300">Heuristic Ingestion & Dynamic Roster Directory</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-end overflow-x-auto py-1">
            <div className="flex p-1 rounded-lg border bg-slate-200/50 dark:bg-slate-850 border-slate-300 dark:border-slate-700 shrink-0">
              <button onClick={() => setActiveTab('database')} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'database' ? 'bg-indigo-650 text-white' : 'text-slate-500 dark:text-slate-400'}`}>Cards</button>
              <button onClick={() => setActiveTab('map')} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'map' ? 'bg-indigo-650 text-white' : 'text-slate-500 dark:text-slate-400'}`}>Map</button>
              <button onClick={() => setActiveTab('sandbox')} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'sandbox' ? 'bg-indigo-650 text-white' : 'text-slate-500 dark:text-slate-400'}`}>Sandbox</button>
              <button onClick={() => setActiveTab('settings')} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'settings' ? 'bg-indigo-650 text-white' : 'text-slate-500 dark:text-slate-400'}`}>App Settings</button>
            </div>

            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 rounded-lg border text-indigo-600 dark:text-amber-400 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors">
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            
            <button onClick={() => setIsAuthenticated(false)} className="p-1.5 rounded-lg border text-slate-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors">
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* COMPACT LOW-PROFILE STATS BAR */}
      <div className="max-w-7xl mx-auto px-4 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between ${cardBg}`}>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Leads</span>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{totalClients}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between ${cardBg}`}>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Geoplotted</span>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{mappedCount}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between ${cardBg}`}>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hub Location</span>
            <span className="text-[11px] font-extrabold truncate text-rose-550">{userLocationName} ({userZip})</span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-4">
        
        {/* =======================================================
            TAB 1: CLIENT CARDS DIRECTORY & DYNAMIC DENSITY LAYOUT
            ======================================================= */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            
            {/* Sync Controls, Filters & Density Slider Panel */}
            <div className={`p-3 rounded-xl border space-y-3 ${cardBg}`}>
              
              <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                
                {/* Search Text and Sort Selection */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      placeholder="Search name, phone, notes, details..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`text-xs pl-9 pr-4 py-2 rounded-lg w-full ${inputStyle}`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">Sort</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`text-xs rounded-lg p-2 ${inputStyle}`}
                    >
                      <option value="date-newest">Date: Newest First</option>
                      <option value="date-oldest">Date: Oldest First</option>
                      <option value="name-az">Name: A - Z</option>
                      <option value="name-za">Name: Z - A</option>
                      <option value="distance-near">Distance: Nearest Hub</option>
                    </select>
                  </div>
                </div>

                {/* Filters, Density Slider, Action Triggers */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  
                  {/* Dynamic Column Density Controller */}
                  <div className="flex items-center gap-2 border border-slate-300 dark:border-slate-800 rounded-lg p-1.5 relative group bg-white dark:bg-slate-900 shrink-0">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Cols Density:</span>
                    <input 
                      type="range"
                      min="0.70"
                      max="1.25"
                      step="0.1"
                      value={cardDensity}
                      onChange={(e) => setCardDensity(parseFloat(e.target.value))}
                      className="w-20 accent-indigo-650 h-1 cursor-pointer"
                    />
                    <span className="text-[9px] font-mono font-bold text-indigo-500">{(cardDensity * 100).toFixed(0)}%</span>
                    
                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 text-center shadow-xl">
                      Condense slider to scale layout cards from 1 up to 4 dynamic grid columns!
                    </div>
                  </div>

                  {/* Operational Controls with Sync Range Pickers */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden shrink-0 bg-white dark:bg-slate-900">
                      <select
                        value={refreshDays}
                        onChange={(e) => setRefreshDays(parseInt(e.target.value))}
                        className="text-[10px] font-bold p-1.5 bg-transparent text-slate-600 dark:text-slate-300 focus:outline-none"
                      >
                        <option value="7">7 Days</option>
                        <option value="14">14 Days</option>
                        <option value="30">30 Days</option>
                        <option value="90">3 Months</option>
                        <option value="365">1 Year</option>
                        <option value="1825">5 Years</option>
                      </select>

                      <button 
                        onClick={() => triggerScan('recent')} 
                        disabled={isScanning} 
                        className="bg-indigo-650 hover:bg-indigo-600 text-white py-1.5 px-3 text-xs font-bold transition-all shrink-0 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Sync Now</span>
                      </button>
                    </div>

                    <button 
                      onClick={startNewClientForm} 
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Intake</span>
                    </button>
                  </div>

                </div>

              </div>

              {/* Advanced Target Filters Bar */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">State Location:</span>
                  <div className="flex rounded-md border border-slate-300 dark:border-slate-800 p-0.5 bg-slate-150 dark:bg-slate-950">
                    {['ALL', 'FL', 'CA', 'NY', 'OTHER'].map(st => (
                      <button
                        key={st}
                        onClick={() => setStateFilter(st)}
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${stateFilter === st ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500'}`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Shoot Type:</span>
                  <div className="flex rounded-md border border-slate-300 dark:border-slate-800 p-0.5 bg-slate-150 dark:bg-slate-950">
                    {['ALL', 'WEDDING', 'COUPLES', 'FAMILY'].map(tp => (
                      <button
                        key={tp}
                        onClick={() => setTypeFilter(tp)}
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${typeFilter === tp ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500'}`}
                      >
                        {tp}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedIds.size > 0 && (
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-black animate-pulse">
                    {selectedIds.size} cards selected. Hold Ctrl/Cmd or Shift to select multiple.
                  </span>
                )}

              </div>

            </div>

            {/* Core Client Card Lists Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              <div className="lg:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Filtered Client Cards ({sortedAndFilteredClients.length})</h3>
                  <span className="text-[9px] text-slate-400 italic">Resize columns via density slider</span>
                </div>

                {sortedAndFilteredClients.length === 0 ? (
                  <div className={`border p-12 text-center rounded-xl ${cardBg}`}>
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold">No matching profiles found in database.</p>
                  </div>
                ) : (
                  <div className={`grid gap-2.5 transition-all ${gridLayoutClass}`}>
                    {sortedAndFilteredClients.map((client) => {
                      const clientCoords = getClientCoords(client);
                      const distance = calculateDistanceInMiles(userCoords, clientCoords);
                      const isUnspecified = !client.location || client.location === "Not Specified";
                      const guess = isUnspecified ? inferLocationFromNarrative(client.summary, client.name, client.phone) : null;
                      const segmentType = getClientInquiryType(client);
                      const isSelected = selectedIds.has(client.id);

                      return (
                        <div 
                          key={client.id}
                          onClick={(e) => handleCardClick(client, e)}
                          style={{ padding: `${cardDensity * 12}px` }}
                          className={`border rounded-xl cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between relative ${isSelected ? 'border-indigo-650 ring-2 ring-indigo-550/20 bg-indigo-550/10' : cardBg}`}
                        >
                          <div className={`absolute top-0 right-0 h-1 w-12 rounded-bl ${guess ? 'bg-amber-500' : 'bg-indigo-600'}`}></div>

                          <div>
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 pr-2">
                                {/* Fixed color contrast: explicit dark & light theme classes ensure client names are completely legible */}
                                <h4 className="font-black text-slate-900 dark:text-slate-100 truncate" style={{ fontSize: `${cardDensity * 14}px` }}>
                                  {client.name}
                                </h4>
                                <span className="text-[9px] text-slate-400 block mt-0.5">{new Date(client.receivedAt).toLocaleDateString()}</span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                                )}
                              </div>
                            </div>

                            <div className="mt-2 space-y-1 text-xs text-slate-650 dark:text-slate-350" style={{ fontSize: `${cardDensity * 11}px` }}>
                              <div className="flex items-center gap-1.5 truncate">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{client.email || "No Email"}</span>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{guess ? guess.locationName : client.location}</span>
                                </div>
                                {distance !== null && (
                                  <span className="text-[9px] font-bold px-1 py-0.5 bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 rounded font-mono shrink-0">
                                    {distance.toFixed(0)} mi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[9px] bg-slate-150 dark:bg-slate-950 font-black px-1.5 py-0.5 rounded text-slate-500">
                              {segmentType}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold italic">
                              {client.source?.substring(0, 15)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inspector detailed panel view */}
              <div>
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Inspection Workspace</h3>
                
                {selectedClient ? (
                  <div className={`p-4 border rounded-xl space-y-4 relative ${cardBg}`}>
                    <div className="flex justify-between items-start pb-3.5 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-650 dark:text-indigo-450 font-black uppercase px-2 py-0.5 rounded border border-indigo-500/15">Selected Document</span>
                        <h4 className="text-base font-black mt-1 text-slate-900 dark:text-white">{selectedClient.name}</h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEditClientForm(selectedClient)} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded text-slate-500 dark:text-slate-400 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteClient(selectedClient.id)} className="p-1.5 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded text-rose-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                        <div className={`p-2 rounded-lg flex items-center justify-between text-xs font-mono mt-0.5 ${innerCardBg}`}>
                          <span className="truncate pr-2 text-slate-800 dark:text-slate-200">{selectedClient.email || "Not Extracted"}</span>
                          {selectedClient.email && (
                            <button 
                              onClick={() => {
                                const ta = document.createElement("textarea");
                                ta.value = selectedClient.email;
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand('copy');
                                document.body.removeChild(ta);
                                addLog("Copied client email to clipboard.", "info");
                              }}
                              className="text-[10px] text-indigo-500 hover:underline font-bold shrink-0"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Phone Contact</span>
                          <div className={`p-2 rounded-lg text-xs font-mono mt-0.5 truncate text-slate-800 dark:text-slate-200 ${innerCardBg}`}>
                            {selectedClient.phone || "Not Extracted"}
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Shoot Type</span>
                          <div className={`p-2 rounded-lg text-xs font-bold mt-0.5 truncate text-indigo-550 dark:text-indigo-400 ${innerCardBg}`}>
                            {getClientInquiryType(selectedClient)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Shoot Target Location</span>
                        <div className={`p-2 rounded-lg text-xs mt-0.5 text-slate-800 dark:text-slate-200 ${innerCardBg}`}>
                          <span>{selectedClient.location || "Not Specified"}</span>
                          {(!selectedClient.location || selectedClient.location === "Not Specified") && (
                            <p className="text-[10px] text-amber-500 font-bold mt-1">
                              ⚠️ Best Guess: {inferLocationFromNarrative(selectedClient.summary, selectedClient.name, selectedClient.phone)?.locationName || "No Florida Matches Found"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Inquiry Summary Details</span>
                        <p className={`p-2.5 rounded-lg text-xs leading-relaxed italic mt-0.5 text-slate-650 dark:text-slate-350 ${innerCardBg}`}>
                          "{selectedClient.summary || 'No description extracted.'}"
                        </p>
                      </div>

                      {/* Notes Section styled to match the rest of the details (no white box in dark mode) */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Custom Workspace Notes</span>
                        <textarea
                          rows="3"
                          value={selectedClient.notes || ''}
                          onChange={(e) => handleUpdateNotes(selectedClient.id, e.target.value)}
                          placeholder="Type customer follow-up notes, special requests, and quotes..."
                          className={`w-full text-xs p-2.5 rounded-lg mt-0.5 border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${innerCardBg}`}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <a
                        href={`mailto:${selectedClient.email}?subject=Your Inquiry with Us&body=Hi ${selectedClient.name.split(' ')[0]},\n\nWe received your HoneyBook inquiry regarding our services. We'd love to chat details!\n\nBest regards.`}
                        className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Response Template</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className={`p-12 border rounded-xl text-center text-xs text-slate-450 ${cardBg}`}>
                    Select an inquiry card to inspect details.
                  </div>
                )}
              </div>

            </div>

            {/* SYNC TERMINAL COMPONENT - BOTTOM OF THE MAIN CLIENT SCREEN */}
            <div className={`border rounded-xl overflow-hidden shadow-md ${cardBg}`}>
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-200">
                <div className="flex items-center gap-2 text-xs font-black">
                  <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span>Sync Telemetry Buffer</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSyncLogs([])} className="text-[9px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-bold">Clear</button>
                  <button onClick={() => setIsTerminalMinimized(!isTerminalMinimized)} className="text-[9px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-indigo-400 font-bold">
                    {isTerminalMinimized ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>

              {!isTerminalMinimized && (
                <div className="p-3 bg-slate-950 font-mono text-[11px] h-28 overflow-y-auto space-y-1">
                  {syncLogs.length === 0 ? (
                    <div className="text-slate-600 italic">No output in trace buffer. Trigger a sync lookup scan to view operations.</div>
                  ) : (
                    syncLogs.map((log, idx) => {
                      let col = "text-slate-400";
                      if (log.includes("[SUCCESS]")) col = "text-emerald-400 font-semibold";
                      else if (log.includes("[DANGER]") || log.includes("[ERROR]")) col = "text-rose-500 font-bold";
                      else if (log.includes("[WARNING]")) col = "text-amber-500 font-semibold";
                      else if (log.includes("[SYSTEM]")) col = "text-indigo-400";
                      return (
                        <div key={idx} className={`${col} leading-tight`}>{log}</div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* =======================================================
            TAB 2: CLIENT MAP VISUALIZATION PAGE
            ======================================================= */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className={`p-4 border rounded-xl ${cardBg}`}>
              <h2 className="text-sm sm:text-base font-black flex items-center gap-1.5 text-slate-900 dark:text-white">
                <Map className="w-4 h-4 text-indigo-400 shrink-0" />
                Dynamic Geoplotting Workspace
              </h2>
              <p className="text-xs opacity-75 mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
                Visualizing target coordinate matrices against your registered business center at <strong className="text-rose-500">{userLocationName} (★)</strong>. Mapped markers show verified coordinates, while best guess algorithm plots are in <strong className="text-amber-500">Orange</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className={`border p-1.5 h-[400px] rounded-xl flex items-center justify-center relative bg-slate-950 ${cardBg}`}>
                <div ref={mapContainerRef} className="w-full h-full rounded-lg z-10" />
                {!mapLoaded && (
                  <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center text-slate-300 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                    <p className="text-xs font-semibold">Resolving Leaflet coordinate maps...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 3: SANDBOX EMAIL PARSER PANEL
            ======================================================= */}
        {activeTab === 'sandbox' && (
          <div className="space-y-4">
            <div className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBg}`}>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Sandbox Email Testing Gateway</h2>
                <p className="text-xs opacity-75 mt-1 text-slate-750 dark:text-slate-300">Simulate plain-text HoneyBook email extraction to verify formatting structures before live API setups.</p>
              </div>

              <button onClick={handlePurgeSandboxData} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-550 text-white rounded-lg text-xs font-bold shadow-md flex items-center justify-center gap-1 transition-all shrink-0">
                <Trash className="w-3.5 h-3.5" />
                <span>Purge Sandbox Leads</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`p-4 border rounded-xl space-y-3.5 ${cardBg}`}>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Interactive Mail Simulator</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Subject Title Line</label>
                    <input 
                      type="text"
                      value={sandboxEmailSubject}
                      onChange={(e) => setSandboxEmailSubject(e.target.value)}
                      className={`w-full text-xs p-2 rounded-lg ${inputStyle}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-555 uppercase mb-1">Email Body Payload</label>
                    <textarea
                      rows="6"
                      value={sandboxEmailBody}
                      onChange={(e) => setSandboxEmailBody(e.target.value)}
                      className={`w-full text-xs font-mono p-2.5 rounded-lg leading-relaxed ${inputStyle}`}
                    />
                  </div>
                </div>
              </div>

              <div className={`p-4 border rounded-xl space-y-3.5 ${cardBg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Parsed Matrix</span>
                  <button 
                    onClick={() => {
                      if (!parsedSandboxData) return;
                      const newLead = {
                        ...parsedSandboxData,
                        id: "sim-hb-" + Math.random().toString(36).substr(2, 9),
                        receivedAt: new Date().toISOString(),
                        source: "HoneyBook Sandbox"
                      };
                      setClients([newLead, ...clients]);
                      setSelectedClient(newLead);
                      setSandboxAdded(true);
                      addLog(`Added sandbox lead: ${newLead.name}`, "success");
                    }}
                    disabled={!parsedSandboxData || sandboxAdded} 
                    className="px-3 py-1 bg-indigo-655 hover:bg-indigo-600 text-white rounded text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {sandboxAdded ? "Added Successfully!" : "Save to cards"}
                  </button>
                </div>

                {parsedSandboxData ? (
                  <div className="space-y-2 text-xs">
                    <div className={`p-2.5 rounded-lg ${innerCardBg}`}>
                      <strong className="block text-[9px] text-slate-400 uppercase font-bold">Client Name</strong>
                      <span className="font-bold text-indigo-500">{parsedSandboxData.name}</span>
                    </div>
                    <div className={`p-2.5 rounded-lg ${innerCardBg}`}>
                      <strong className="block text-[9px] text-slate-400 uppercase font-bold">Email Target</strong>
                      <span className="text-slate-800 dark:text-slate-200">{parsedSandboxData.email || "No Email Extracted"}</span>
                    </div>
                    <div className={`p-2.5 rounded-lg ${innerCardBg}`}>
                      <strong className="block text-[9px] text-slate-400 uppercase font-bold">Inferred Venue Location</strong>
                      <span className="text-slate-800 dark:text-slate-200">{parsedSandboxData.location}</span>
                    </div>
                    <div className={`p-2.5 rounded-lg ${innerCardBg}`}>
                      <strong className="block text-[9px] text-slate-400 uppercase font-bold">Narrative Details</strong>
                      <p className="italic text-slate-850 dark:text-slate-300">"{parsedSandboxData.summary}"</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-rose-500 bg-rose-500/5 rounded-lg border border-rose-500/20 font-bold">
                    Email payload dropped. Filter requires "New Inquiry Added" in subject to verify.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 4: APP SETTINGS PANEL (RE-NAMED & SECURED)
            ======================================================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            <div className="lg:col-span-5 space-y-4">
              
              <div className={`p-5 border rounded-xl space-y-3.5 ${cardBg}`}>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Business Central Hub</h3>
                <p className="text-xs opacity-75 leading-relaxed text-slate-755 dark:text-slate-350">Modify your core workspace location coordinates. Sorting directories by distance uses this hub index.</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Business US ZIP Code</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        maxLength="5"
                        placeholder="e.g. 34205"
                        value={userZip}
                        onChange={(e) => setUserZip(e.target.value.replace(/\D/g, ''))}
                        className={`text-xs p-2 rounded-lg w-full ${inputStyle}`}
                      />
                      <button onClick={() => handleResolveZipCode(userZip)} disabled={resolvingZip || userZip.length < 5} className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-lg text-xs disabled:opacity-50 transition-all">
                        {resolvingZip ? "Querying..." : "Update"}
                      </button>
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg text-xs flex justify-between ${innerCardBg}`}>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">Resolved Area</span>
                      <strong className="text-indigo-500">{userLocationName}</strong>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-slate-555">{userCoords.map(c => c.toFixed(3)).join(', ')}</span>
                  </div>
                </div>
              </div>

              <div className={`p-5 border rounded-xl space-y-3.5 ${cardBg}`}>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Connection credentials</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Deployed Script Web App URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="https://script.google.com/macros/s/..."
                        value={appsScriptUrl}
                        onChange={(e) => {
                          setAppsScriptUrl(e.target.value);
                          localStorage.setItem('inquireflow_gas_url', e.target.value);
                        }}
                        className={`text-xs p-2 rounded-lg w-full ${inputStyle}`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className={`w-2 h-2 rounded-full ${appsScriptUrl ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {appsScriptUrl ? "Live Credentials Active" : "Simulated Sandbox Mode"}
                    </span>
                    <button 
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text.trim().startsWith("https://script.google.com/")) {
                            setAppsScriptUrl(text.trim());
                            localStorage.setItem('inquireflow_gas_url', text.trim());
                            addLog("Pasted Google Script URL.", "success");
                          } else {
                            addLog("Invalid script URL pattern in clipboard.", "warning");
                          }
                        } catch(e) {
                          addLog("Clipboard permission denied.", "warning");
                        }
                      }} 
                      className="text-indigo-500 hover:underline font-bold"
                    >
                      Paste
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div className="lg:col-span-7">
              <div className={`border rounded-xl overflow-hidden ${cardBg}`}>
                <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-slate-200">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-indigo-400" />
                    Deployment App Script Code (V3)
                  </span>
                  <button 
                    onClick={() => {
                      const ta = document.createElement("textarea");
                      ta.value = APPS_SCRIPT_CODE_V2;
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand('copy');
                      document.body.removeChild(ta);
                      addLog("Apps Script copied successfully.", "info");
                    }} 
                    className="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded text-xs font-bold"
                  >
                    Copy Template
                  </button>
                </div>

                <div className="p-4 bg-slate-950 font-mono text-xs overflow-auto max-h-[300px]">
                  <pre className="whitespace-pre text-slate-400 leading-relaxed">{APPS_SCRIPT_CODE_V2}</pre>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* MULTI-SELECT FLOATING ACTION DRAWER */}
      {selectedIds.size > 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-fade-in-up">
          <div className="bg-slate-900 border border-indigo-500/30 text-white shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-extrabold text-white">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-xs font-black">Clients Selected</p>
                <p className="text-[10px] text-slate-400 font-medium">Batch actions ready</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs">
              <button 
                onClick={handleBulkCopyEmails}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-indigo-400 font-bold rounded-lg flex items-center gap-1 hover:text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Emails</span>
              </button>
              <button 
                onClick={handleBulkDelete}
                className="px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white font-bold rounded-lg flex items-center gap-1 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete Selected</span>
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-6 mt-8 text-center text-[10px] text-slate-500 border-t border-slate-150 dark:border-slate-900">
        <p>© 2026 InquireFlow V3. Built for HoneyBook automated pipelines.</p>
      </footer>

      {/* =======================================================
          MODAL: MANUAL CARD INTAKE & EDITOR FORM
          ======================================================= */}
      {isEditing && editClientData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`border rounded-xl max-w-md w-full overflow-hidden shadow-2xl ${cardBg}`}>
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">{editClientData.id ? "Edit Client Details" : "New Client Intake"}</h4>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSaveClient} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-555 uppercase tracking-wider mb-1">Client Full Name *</label>
                <input 
                  type="text"
                  required
                  value={editClientData.name}
                  onChange={(e) => setEditClientData({ ...editClientData, name: e.target.value })}
                  className={`w-full p-2 rounded ${inputStyle}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-555 uppercase mb-1">Email Address</label>
                  <input 
                    type="email"
                    value={editClientData.email}
                    onChange={(e) => setEditClientData({ ...editClientData, email: e.target.value })}
                    className={`w-full p-2 rounded ${inputStyle}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-555 uppercase mb-1">Phone Number</label>
                  <input 
                    type="text"
                    value={editClientData.phone}
                    onChange={(e) => setEditClientData({ ...editClientData, phone: e.target.value })}
                    className={`w-full p-2 rounded ${inputStyle}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-555 uppercase mb-1">Shoot Venue Target Location</label>
                <input 
                  type="text"
                  placeholder="e.g. Sarasota, FL"
                  value={editClientData.location}
                  onChange={(e) => setEditClientData({ ...editClientData, location: e.target.value })}
                  className={`w-full p-2 rounded ${inputStyle}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-555 uppercase mb-1">Inquiry Details *</label>
                <textarea 
                  rows="3"
                  required
                  value={editClientData.summary}
                  onChange={(e) => setEditClientData({ ...editClientData, summary: e.target.value })}
                  className={`w-full p-2 rounded ${inputStyle}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-555 uppercase mb-1">Follow-up Notes</label>
                <textarea 
                  rows="2"
                  value={editClientData.notes || ''}
                  onChange={(e) => setEditClientData({ ...editClientData, notes: e.target.value })}
                  placeholder="Enter private tracking notes..."
                  className={`w-full p-2 rounded ${inputStyle}`}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditing(false)} className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-xs text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded text-xs transition-colors">Save Card</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: CUSTOM CONFIRMATION DIALOG (Enter Approved)
          ======================================================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className={`border rounded-xl shadow-2xl max-w-sm w-full overflow-hidden ${cardBg}`}>
            <div className="p-5 space-y-4 text-center">
              <div className="p-2.5 bg-rose-500/10 rounded-full w-10 h-10 flex items-center justify-center mx-auto text-rose-550 border border-rose-500/15">
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{confirmModal.message}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 text-xs">
                <button 
                  type="button" 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg font-bold"
                >
                  {confirmModal.cancelText}
                </button>
                
                <button 
                  id="modal-action-confirm-btn" 
                  type="button" 
                  onClick={confirmModal.onConfirm} 
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-550 text-white font-bold rounded-lg shadow transition-colors"
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}