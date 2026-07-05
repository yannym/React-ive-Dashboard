import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";
import * as esbuild from "esbuild";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware to support cross-origin requests from external clients (e.g., GitHub Pages)
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

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

  // API Endpoint to compile any component .tsx file on the fly to browser CommonJS format
  app.get("/api/compile-component/:name", async (req, res) => {
    try {
      const { name } = req.params;
      // Resolve clean name (without extension, e.g. "tic_tac_toe_bot_duel" or "tic_tac_toe_bot_duel.tsx")
      let cleanName = path.basename(name).replace(/[^a-zA-Z0-9_\.-]/g, "_");
      if (cleanName.endsWith(".tsx")) {
        cleanName = cleanName.substring(0, cleanName.length - 4);
      }
      
      const filePath = path.join(process.cwd(), "src", "components", `${cleanName}.tsx`);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `TSX component file not found: ${cleanName}.tsx` });
      }

      // Read content to compile
      const fileContent = fs.readFileSync(filePath, "utf8");

      // Compile/transpile using esbuild
      // Format is CommonJS (cjs) so that we can easily mock "require" and intercept imports of React/lucide-react, etc.
      const result = await esbuild.transform(fileContent, {
        loader: "tsx",
        format: "cjs",
        target: "es2020",
        jsx: "transform",
        sourcemap: "inline"
      });

      res.json({
        success: true,
        componentKey: cleanName,
        code: result.code
      });
    } catch (err: any) {
      console.error("Failed to compile custom component:", err);
      res.status(500).json({ error: err?.message || "Failed to compile custom TSX component" });
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

  // API Terminal execution endpoint to run shell commands inside container / NAS workspace
  app.post("/api/terminal/run", (req, res) => {
    try {
      const { command, cwd } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command is required." });
      }

      const baseDir = process.cwd();
      const safeCwd = cwd ? path.resolve(baseDir, cwd) : baseDir;

      exec(command, { cwd: safeCwd, timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        res.json({
          success: !error,
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: error ? (error.code || 1) : 0,
          currentCwd: safeCwd
        });
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to execute command." });
    }
  });

  // ==================== GEMINI AI COPILOT ENDPOINT ====================
  const listFilesDeclaration = {
    name: "listFiles",
    description: "Lists all files and directories inside a given directory, relative to the workspace root.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "The directory path to list, relative to the workspace root, e.g. '.', 'src', or 'src/components'."
        }
      }
    }
  };

  const readFileDeclaration = {
    name: "readFile",
    description: "Reads the content of a file, relative to the workspace root, and returns it as a string.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "The path of the file to read, e.g. 'src/components/HelloWorld.tsx'."
        }
      },
      required: ["path"]
    }
  };

  const writeFileDeclaration = {
    name: "writeFile",
    description: "Writes content to a file, relative to the workspace root. Use this to create or edit React TSX components or other files.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "The path of the file to save/write, e.g. 'src/components/CoolComponent.tsx'."
        },
        content: {
          type: Type.STRING,
          description: "The complete file text content. If writing a React component, ensure it has a default export."
        }
      },
      required: ["path", "content"]
    }
  };

  const listFilesHelper = (targetPath: string = ".") => {
    try {
      const safePath = getSafePath(targetPath);
      if (!fs.existsSync(safePath)) return { error: "Path does not exist" };
      const stats = fs.statSync(safePath);
      if (!stats.isDirectory()) return { error: "Path is a file, not a directory" };
      const items = fs.readdirSync(safePath);
      return {
        success: true,
        path: targetPath,
        contents: items.filter(item => item !== "node_modules" && item !== ".git" && item !== "dist" && item !== ".cache")
      };
    } catch (e: any) {
      return { error: e.message || "Failed to list directory" };
    }
  };

  const readFileHelper = (targetPath: string) => {
    try {
      const safePath = getSafePath(targetPath);
      if (!fs.existsSync(safePath)) return { error: "File not found" };
      const stats = fs.statSync(safePath);
      if (stats.isDirectory()) return { error: "Path is a directory, not a file" };
      const content = fs.readFileSync(safePath, "utf8");
      return { success: true, path: targetPath, content };
    } catch (e: any) {
      return { error: e.message || "Failed to read file" };
    }
  };

  const writeFileHelper = (targetPath: string, content: string) => {
    try {
      const safePath = getSafePath(targetPath);
      const parentDir = path.dirname(safePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(safePath, content, "utf8");
      return { success: true, path: targetPath, message: "File saved successfully." };
    } catch (e: any) {
      return { error: e.message || "Failed to write file" };
    }
  };

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history, useTools } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets." 
        });
      }

      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const systemInstruction = 
        "You are 'Gemini Copilot', an expert AI coding and system workspace assistant embedded in the Applet Cockpit Dashboard.\n" +
        "You run inside a server-side container with access to workspace tools. " +
        "If the user asks you to create or modify a custom React applet/component, save it to 'src/components/MyComponent.tsx' (or whatever filename makes sense). Always write valid TSX. Every custom component MUST use a default export (e.g., 'export default function MyComponent() { ... }').\n" +
        "Do not explain your tools usage in long detail, just list files, read code, make edits, and then give a concise, helpful summary to the user. You are brilliant, fast, and helpful.";

      const tools: any[] = [];
      if (useTools) {
        tools.push({
          functionDeclarations: [listFilesDeclaration, readFileDeclaration, writeFileDeclaration]
        });
      }

      const contents: any[] = [];
      if (history && Array.isArray(history)) {
        history.forEach((h: any) => {
          contents.push({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }]
          });
        });
      }

      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      let loopCount = 0;
      let finalResponseText = "";
      let lastResponse: any = null;

      while (loopCount < 8) {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents,
          config: {
            systemInstruction,
            tools: tools.length > 0 ? tools : undefined,
          }
        });

        lastResponse = response;
        const functionCalls = response.functionCalls;

        if (!functionCalls || functionCalls.length === 0) {
          finalResponseText = response.text || "";
          break;
        }

        contents.push(response.candidates?.[0]?.content);

        const functionResponses: any[] = [];
        for (const fc of functionCalls) {
          let result: any = null;
          try {
            if (fc.name === "listFiles") {
              const args = fc.args as any;
              result = listFilesHelper(args?.path || ".");
            } else if (fc.name === "readFile") {
              const args = fc.args as any;
              result = readFileHelper(args?.path);
            } else if (fc.name === "writeFile") {
              const args = fc.args as any;
              result = writeFileHelper(args?.path, args?.content);
            } else {
              result = { error: `Function '${fc.name}' is not supported.` };
            }
          } catch (err: any) {
            result = { error: err.message || "Failed execution" };
          }

          functionResponses.push({
            response: result
          });
        }

        contents.push({
          role: "tool",
          parts: functionResponses.map((res, i) => ({
            functionResponse: {
              name: functionCalls[i].name,
              response: res.response
            }
          }))
        });

        loopCount++;
      }

      res.json({
        success: true,
        text: finalResponseText || lastResponse?.text || "Task executed."
      });

    } catch (err: any) {
      console.error("Gemini Copilot route error:", err);
      let errorMessage = err.message || "Gemini route error";
      const errString = typeof err === 'object' ? JSON.stringify(err) : String(err);
      if (
        errorMessage.includes("429") || 
        errorMessage.includes("RESOURCE_EXHAUSTED") || 
        errorMessage.includes("quota") ||
        errString.includes("429") ||
        errString.includes("RESOURCE_EXHAUSTED")
      ) {
        errorMessage = "Gemini API free-tier quota exceeded. The shared API key has reached its rate limits. Please wait about 60 seconds and try again, or configure your own custom backend server / Gemini credentials.";
      }
      res.status(500).json({ error: errorMessage });
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
