import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { floorplanTools } from './modules/floorplan/floorplan.tools.js';
export function startExpressServer() {
    const app = express();
    app.use(cors({ origin: '*' }));
    app.use(express.json());
    const upload = multer({ storage: multer.memoryStorage() });
    const tools = new floorplanTools();
    // Mock execution context for tools
    const mockContext = {
        logger: {
            info: console.log,
            error: console.error,
            warn: console.warn,
            debug: console.debug
        }
    };
    app.post('/pipeline', upload.single('file'), async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ error: 'No file uploaded' });
            const image_b64 = req.file.buffer.toString('base64');
            const result = await tools.analyzeFloorPlan({ image_b64 }, mockContext);
            res.json({
                plan: result.plan,
                processed_image: result.processed_image
            });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/estimate-cost', async (req, res) => {
        try {
            const { plan, location, quality } = req.body;
            const result = await tools.estimateCost({ plan, location, quality }, mockContext);
            res.json(result);
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/chat', async (req, res) => {
        try {
            const { message, plan, history } = req.body;
            const result = await tools.chat({ message, plan, history }, mockContext);
            res.json(result);
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    });
    const port = process.env.EXPRESS_PORT || 8000;
    app.listen(port, () => {
        console.log(`Express API running on port ${port}`);
    });
}
//# sourceMappingURL=express.server.js.map