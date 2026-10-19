require('dotenv').config();

const crypto = require('node:crypto');
const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Analysis = require('./models/Analysis');

const app = express();
const port = process.env.PORT || 3000;
const uploadsDirectory = path.join(__dirname, 'uploads');
const analyzerPath = path.join(__dirname, 'ai', 'analyzer.py');

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

// Görev durumunu veritabanında günceller; hata olursa sadece loglar
const updateAnalysis = async (taskId, update) => {
  try {
    await Analysis.findByIdAndUpdate(taskId, update);
  } catch (error) {
    console.error(`[analysis:${taskId}] Veritabanı güncellenemedi:`, error);
  }
};

app.post('/api/analyze', uploadVideo, async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'Form-data içinde video dosyası gerekli.',
    });
  }

  let taskId;
  try {
    const analysisDoc = await Analysis.create({ status: 'processing' });
    taskId = analysisDoc._id.toString();
  } catch (error) {
    return next(error);
  }

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

  let analyzer;
  try {
    analyzer = spawn(python, [...pythonArgs, analyzerPath, req.file.path], {
      cwd: __dirname,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    console.error(`[analysis:${taskId}] Python analiz süreci başlatılamadı:`, error);
    await updateAnalysis(taskId, {
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
    console.error(`[analysis:${taskId}] Python analiz süreci başlatılamadı:`, error);
    updateAnalysis(taskId, {
      status: 'failed',
      error: 'Python analiz süreci başlatılamadı.',
    });
  });

  analyzer.on('close', async (code) => {
    if (code === 0) {
      try {
        const analysis = JSON.parse(stdout.trim());
        if (analysis.status !== 'success') {
          await updateAnalysis(taskId, {
            status: 'failed',
            error: analysis.message || 'Video analizi tamamlanamadı.',
          });
          console.error(`[analysis:${taskId}]`, analysis);
          return;
        }

        await updateAnalysis(taskId, {
          status: 'completed',
          dominant_emotion: analysis.dominantEmotion,
          emotions: {
            sampledFrames: analysis.sampledFrames,
            emotionCounts: analysis.emotionCounts,
            averageEmotionScores: analysis.averageEmotionScores,
          },
        });
        console.log(`[analysis:${taskId}]`, analysis);
      } catch (error) {
        console.error(
          `[analysis:${taskId}] Analiz motoru geçersiz JSON döndürdü:`,
          error,
          stdout,
        );
        await updateAnalysis(taskId, {
          status: 'failed',
          error: 'Analiz sonucu okunamadı.',
        });
      }
      return;
    }

    await updateAnalysis(taskId, {
      status: 'failed',
      error: 'Video analizi tamamlanamadı.',
    });
    console.error(
      `[analysis:${taskId}] Analiz motoru ${code} koduyla sonlandı:`,
      stderr || stdout || 'Hata çıktısı yok.',
    );
  });

  return res.status(202).json({
    status: 'success',
    taskId,
    message: 'Video analiz kuyruğuna alındı',
  });
});

app.get('/api/analyze/:taskId', async (req, res, next) => {
  const { taskId } = req.params;
  if (!mongoose.isValidObjectId(taskId)) {
    return res.status(404).json({
      status: 'error',
      message: 'Analiz görevi bulunamadı.',
    });
  }

  try {
    const task = await Analysis.findById(taskId).lean();
    if (!task) {
      return res.status(404).json({
        status: 'error',
        message: 'Analiz görevi bulunamadı.',
      });
    }

    const { _id, __v, ...rest } = task;
    // İstemci `analysis` alanını bekliyor; veritabanı alanlarından üretilir
    const analysis =
      task.status === 'completed'
        ? { dominantEmotion: task.dominant_emotion, ...task.emotions }
        : undefined;
    return res.json({ taskId: _id.toString(), ...rest, analysis });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ status: 'error', message: error.message });
  }

  console.error('API hatası:', error);
  return res.status(500).json({
    status: 'error',
    message: 'Sunucu tarafında bir hata oluştu.',
  });
});

async function startServer() {
  try {
    const dnsServers = process.env.MONGODB_DNS_SERVERS
      ?.split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    if (dnsServers?.length) {
      dns.setServers(dnsServers);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB bağlantısı başarılı.');
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bilinmeyen bağlantı hatası.';
    console.error(
      'MongoDB bağlantı hatası:',
      message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, 'mongodb+srv://<gizlendi>'),
    );
    process.exitCode = 1;
  }
}

void startServer();
