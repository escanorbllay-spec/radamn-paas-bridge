const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MASTER_KEY = process.env.RADAMN_MASTER_KEY || "RADAMN_MASTER_KEY_2026";

const authenticateMasterKey = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['x-master-key'];
    
    if (!authHeader || authHeader.replace('Bearer ', '') !== MASTER_KEY) {
        return res.status(401).json({ 
            success: false, 
            error: "Acesso Negado: Master Key inválida ou ausente." 
        });
    }
    next();
};

app.post('/api/v1/paas/ingress', authenticateMasterKey, (req, res) => {
    const startTime = Date.now();
    
    try {
        const { userId, projectId, mode, code, prompt } = req.body;

        const normalizedPayload = {
            userId: userId || "anonymous-nox",
            projectId: projectId || `proj_${Date.now()}`,
            mode: mode || "generate",
            code: code || "",
            prompt: prompt || "",
            timestamp: new Date().toISOString()
        };

        if (!normalizedPayload.prompt && mode !== "chat") {
            return res.status(400).json({ success: false, error: "Prompt não fornecido." });
        }

        return res.status(200).json({
            status: "PAAS_INGRESS_READY",
            latencyMs: Date.now() - startTime,
            payload: normalizedPayload,
            nextAction: "ROUTE_TO_ENGINE_AND_STORAGE"
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: "ONLINE", system: "Radam Nox PaaS Bridge" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Ponte do PaaS ativa na porta ${PORT}`));

module.exports = app;

