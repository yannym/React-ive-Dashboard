import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Serve static files check and parsing
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Helper to prevent path traversal vulnerability attacks
  const getSafePath = (targetRelativePath: string) => {
    const cwd = process.cwd();
    const resolvedPath = path.resolve(cwd, targetRelativePath || ".");
    if (!resolvedPath.startsWith(cwd)) {
      throw new Error("Directory traversal blocked.");
    }
    return resolvedPath;
  };

  // API Endpoint to scan /src/components folder and automatically discover any .tsx files
  app.get("/api/list-components", (req, res) => {
    try {
      const componentsDir = path.join(process.cwd(), "src", "components");
      if (!fs.existsSync(componentsDir)) {
        return res.json({ success: true, components: [] });
      }

      const files = fs.readdirSync(componentsDir);
      const components = files
        .filter(f => f.endsWith(".tsx") && f !== "DynamicComponentLoader.tsx" && f !== "BuiltInApps.tsx")
        .map(f => {
          const key = f.substring(0, f.lastIndexOf("."));
          const stats = fs.statSync(path.join(componentsDir, f));
          return {
            fileName: f,
            componentKey: key,
            size: stats.size,
            updatedAt: stats.mtime.toISOString(),
            applet: {
              id: `manual-${key.toLowerCase()}`,
              name: key.split(/[_-]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
              description: `Custom TSX client module uploaded dynamically inside console: ${f}`,
              url: `internal:component:${key}`,
              isCustomEmbed: false,
              icon: "💻",
              category: "External Tools",
              tags: ["tsx", "dynamic", "uploaded"],
              openMode: "iframe",
              accentColor: "indigo",
              isPinned: false,
              createdAt: stats.birthtime.toISOString(),
              updatedAt: stats.mtime.toISOString()
            }
          };
        });

      res.json({ success: true, components });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to scan dynamic components directory" });
    }
  });

  // API Endpoints for Custom TSX Applet Management
  app.post("/api/upload-applet", (req, res) => {
    try {
      const { name, content } = req.body;
      if (!name || !content) {
        return res.status(400).json({ error: "Name and content are required." });
      }

      // Ensure proper extension and name validation
      let safeName = path.basename(name).replace(/[^a-zA-Z0-9_\.-]/g, "_");
      if (!safeName.endsWith(".tsx")) {
        safeName += ".tsx";
      }

      const filePath = path.join(process.cwd(), "src", "components", safeName);
      const componentsDir = path.dirname(filePath);

      // Create folder hierarchy
      fs.mkdirSync(componentsDir, { recursive: true });

      // Save actual file contents
      fs.writeFileSync(filePath, content, "utf8");

      const componentKey = safeName.substring(0, safeName.lastIndexOf("."));
      const stats = fs.statSync(filePath);

      res.json({
        success: true,
        message: `Parsed and registered ${safeName}`,
        fileName: safeName,
        componentKey: componentKey,
        applet: {
          id: `manual-${componentKey.toLowerCase()}`,
          name: componentKey.split(/[_-]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          description: `Custom TSX client module uploaded dynamically inside console: ${safeName}`,
          url: `internal:component:${componentKey}`,
          isCustomEmbed: false,
          icon: "💻",
          category: "External Tools",
          tags: ["tsx", "dynamic", "uploaded"],
          openMode: "iframe",
          accentColor: "indigo",
          isPinned: false,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString()
        }
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err?.message || "Internal error saving TSX applet" });
    }
  });

  app.post("/api/delete-applet", (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required." });
      }

      const safeName = path.basename(name).replace(/[^a-zA-Z0-9_\.-]/g, "_");
      const filePath = path.join(process.cwd(), "src", "components", safeName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: `Successfully deleted TSX file: ${safeName}` });
      } else {
        res.status(404).json({ error: `File not found: ${safeName}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Internal error deleting TSX applet" });
    }
  });

  // ==================== WORKSPACE FILE SYSTEM ACCESS Fallback API ====================
  app.get("/api/files/list", (req, res) => {
    try {
      const requestedSubPath = (req.query.path as string) || ".";
      const safePath = getSafePath(requestedSubPath);

      if (!fs.existsSync(safePath)) {
        return res.status(404).json({ error: "Target workspace path does not exist." });
      }

      const fileStats = fs.statSync(safePath);
      if (!fileStats.isDirectory()) {
        return res.status(400).json({ error: "Target path is not a directory." });
      }

      const items = fs.readdirSync(safePath);
      const contents: any[] = [];

      for (const item of items) {
        // Exclude system/heavy directories from view to keep scan safe & lightning fast
        if (item === "node_modules" || item === ".git" || item === "dist" || item === ".cache") {
          continue;
        }

        try {
          const fullItemPath = path.join(safePath, item);
          const relativeItemPath = path.relative(process.cwd(), fullItemPath);
          const stats = fs.statSync(fullItemPath);

          contents.push({
            name: item,
            path: relativeItemPath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            updatedAt: stats.mtime.toISOString(),
          });
        } catch (itemErr) {
          // Gracefully omit broken symlinks or inaccessible files
          console.warn(`Ignoring inaccessible node asset: ${item}`, itemErr);
        }
      }

      // Sort: directories first, then alphabetically
      contents.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      res.json({
        success: true,
        currentPath: path.relative(process.cwd(), safePath) || ".",
        isRoot: safePath === process.cwd(),
        contents
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Workspace tree retrieval failed." });
    }
  });

  app.post("/api/files/read", (req, res) => {
    try {
      const { path: relativePath } = req.body;
      if (!relativePath) {
        return res.status(400).json({ error: "Path parameter is required." });
      }

      const safePath = getSafePath(relativePath);
      if (!fs.existsSync(safePath)) {
        return res.status(404).json({ error: `File not found at target: ${relativePath}` });
      }

      const stats = fs.statSync(safePath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: "Cannot read contents of directory as file context." });
      }

      const content = fs.readFileSync(safePath, "utf8");
      res.json({
        success: true,
        path: relativePath,
        content,
        size: stats.size,
        updatedAt: stats.mtime.toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to read file." });
    }
  });

  app.post("/api/files/write", (req, res) => {
    try {
      const { path: relativePath, content } = req.body;
      if (!relativePath) {
        return res.status(400).json({ error: "Path is required." });
      }

      const safePath = getSafePath(relativePath);
      const parentDir = path.dirname(safePath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(safePath, content || "", "utf8");
      const stats = fs.statSync(safePath);

      res.json({
        success: true,
        path: relativePath,
        size: stats.size,
        updatedAt: stats.mtime.toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save file." });
    }
  });

  app.post("/api/files/delete", (req, res) => {
    try {
      const { path: relativePath } = req.body;
      if (!relativePath) {
        return res.status(400).json({ error: "Path is required." });
      }

      const safePath = getSafePath(relativePath);
      if (!fs.existsSync(safePath)) {
        return res.status(404).json({ error: "Target path does not exist." });
      }

      const stats = fs.statSync(safePath);
      if (stats.isDirectory()) {
        fs.rmSync(safePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(safePath);
      }

      res.json({ success: true, message: `Successfully deleted: ${relativePath}` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete target." });
    }
  });

  // Vite development middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Full-stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
