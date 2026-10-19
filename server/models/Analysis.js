const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  status: { type: String, default: 'processing' },
  dominant_emotion: { type: String },
  emotions: { type: Object },
  // Hata durumunda kullanıcıya gösterilecek mesaj
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Analysis', analysisSchema);
