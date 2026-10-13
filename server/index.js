require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const cors = require('cors');
const express = require('express');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;
const uploadsDirectory = path.join(__dirname, 'uploads');
const analyzerPath = path.join(__dirname, 'ai', 'analyzer.py');
const tasks = new Map();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname);
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const uploadVideo = multer({ storage }).single('video');

app.use(cors());
app.use(express.json());

app.post('/api/analyze', uploadVideo, (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'Form-data içinde video dosyası gerekli.',
    });
  }

  const taskId = crypto.randomUUID();
  const configuredPython = process.env.PYTHON_EXECUTABLE;
  const virtualEnvPython = path.join(
    __dirname,
    '.venv',
    process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'python.exe' : 'python',
  );
  const useVirtualEnv = fs.existsSync(virtualEnvPython);
  const python =
    configuredPython ||
    (useVirtualEnv
      ? virtualEnvPython
      : process.platform === 'win32'
        ? 'py'
        : 'python3');
  const pythonArgs =
    process.platform === 'win32' && !configuredPython && !useVirtualEnv
      ? ['-3']
      : [];
  tasks.set(taskId, { status: 'processing' });

  let analyzer;
  try {
    analyzer = spawn(python, [...pythonArgs, analyzerPath, req.file.path], {
      cwd: __dirname,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    console.error(`[analysis:${taskId}] Could not start Python analyzer:`, error);
    tasks.set(taskId, {
      status: 'failed',
      error: 'Python analiz süreci başlatılamadı.',
    });
    return res.status(202).json({
      status: 'success',
      taskId,
      message: 'Video analiz kuyruğuna alındı',
    });
  }
  let stdout = '';
  let stderr = '';

  analyzer.stdout.setEncoding('utf8');
  analyzer.stdout.on('data', (chunk) => {
    stdout += chunk;
  });

  analyzer.stderr.setEncoding('utf8');
  analyzer.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  analyzer.on('error', (error) => {
    console.error(`[analysis:${taskId}] Could not start Python analyzer:`, error);
    tasks.set(taskId, {
      status: 'failed',
      error: 'Python analiz süreci başlatılamadı.',
    });
  });

  analyzer.on('close', (code) => {
    if (code === 0) {
      try {
        const analysis = JSON.parse(stdout.trim());
        if (analysis.status !== 'success') {
          tasks.set(taskId, {
            status: 'failed',
            error: analysis.message || 'Video analizi tamamlanamadı.',
          });
          console.error(`[analysis:${taskId}]`, analysis);
          return;
        }

        tasks.set(taskId, { status: 'completed', analysis });
        console.log(`[analysis:${taskId}]`, analysis);
      } catch (error) {
        console.error(
          `[analysis:${taskId}] Analyzer returned invalid JSON:`,
          error,
          stdout,
        );
        tasks.set(taskId, {
          status: 'failed',
          error: 'Analiz sonucu okunamadı.',
        });
      }
      return;
    }

    tasks.set(taskId, {
      status: 'failed',
      error: 'Video analizi tamamlanamadı.',
    });
    console.error(
      `[analysis:${taskId}] Analyzer exited with code ${code}:`,
      stderr || stdout || 'No error output.',
    );
  });

  return res.status(202).json({
    status: 'success',
    taskId,
    message: 'Video analiz kuyruğuna alındı',
  });
});

app.get('/api/analyze/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({
      status: 'error',
      message: 'Analiz görevi bulunamadı.',
    });
  }

  return res.json({ taskId: req.params.taskId, ...task });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ status: 'error', message: error.message });
  }

  console.error('API error:', error);
  return res.status(500).json({
    status: 'error',
    message: 'Sunucu tarafında bir hata oluştu.',
  });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
