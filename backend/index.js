const express = require('express');
const env = require("dotenv").config()
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/process-image', async (req, res) => {
    try {
        const { imageDataUrl } = req.body;

        const genAI = new GoogleGenerativeAI("AIzaSyDHzxPkKlgKzBtNX9iYWwqsyJexp6rROPM");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent([
            "Solve the above Question step by step write every step to solve that problem or if any question ask like what is this and this stuff so give them answer in detail way explain every stuff",
            {
                inlineData: {
                    data: imageDataUrl.split(',')[1],
                    mimeType: "image/png"
                },
            },
        ]);

        const response = await result.response;
        const text = await response.text();

        res.json({ latexExpression: ` (${text} )` });
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).json({ error: 'Error processing image' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});