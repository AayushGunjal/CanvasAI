import React, { useRef, useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { GoogleGenerativeAI } from '@google/generative-ai';

const Button = ({ onClick, className, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-md font-semibold ${className}`}
    >
        {children}
    </button>
);

const DrawingApp = () => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('white');
    const [latexExpression, setLatexExpression] = useState('');
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [eraserSize, setEraserSize] = useState(10);
    const [isEraserActive, setIsEraserActive] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 100;
            ctx.lineCap = 'round';
            ctx.lineWidth = 3;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
            });
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    useEffect(() => {
        let startY;

        const handleTouchStart = (e) => {
            startY = e.touches[0].pageY;
        };

        const handleTouchMove = (e) => {
            const y = e.touches[0].pageY;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop === 0 && y > startY) {
                e.preventDefault();  // Disable pull-to-refresh
            }
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    const getPosition = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if (e.type.startsWith('touch')) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
    };

    const startDrawing = (e) => {
        const pos = getPosition(e);
        setLastPos(pos);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const currentPos = getPosition(e);

        if (isEraserActive) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(currentPos.x, currentPos.y, eraserSize / 2, 0, Math.PI * 2, false);
            ctx.fill();
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();
        }

        setLastPos(currentPos);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setLatexExpression('');
    };

    const processImage = async () => {
        const canvas = canvasRef.current;
        const imageDataUrl = canvas.toDataURL('image/png');

        try {
            const genAI = new GoogleGenerativeAI("AIzaSyDHzxPkKlgKzBtNX9iYWwqsyJexp6rROPM");
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `Analyze the image and provide:

            1. For math problems:
               - Show step-by-step solution
               - Include final answer
               - Explain each step briefly
               - Format example:
                 • Problem: 2x + 5 = 15
                 • Step 1: Subtract 5 from both sides → 2x = 10
                 • Step 2: Divide both sides by 2 → x = 5
                 • Solution: x = 5

            2. For other content:
               - Key information with brief explanations
               - Use bullet points
               - Keep explanations concise

            3. General rules:
               - Be clear and methodical for math
               - Keep other responses brief
               - Structure information logically
            `;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageDataUrl.split(',')[1],
                        mimeType: "image/png"
                    },
                },
            ]);

            const response = await result.response;
            const text = await response.text();
            setLatexExpression(text);

            // Scroll to the result after it's rendered
            setTimeout(() => {
                const resultElement = document.getElementById('result-container');
                if (resultElement) {
                    resultElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        } catch (error) {
            console.error('Error processing image:', error);
            setLatexExpression('Error processing image');
        }
    };

    const selectColor = (newColor) => {
        setColor(newColor);
        setIsEraserActive(false);
    };

    const handleDragStop = (e, data) => {
        const canvas = canvasRef.current;
        const maxWidth = Math.min(300, window.innerWidth - 20); // Adjust max width for mobile
        const maxHeight = Math.min(300, window.innerHeight - 20); // Adjust max height for mobile

        let newX = data.x;
        let newY = data.y;

        if (newX + maxWidth > canvas.width) newX = canvas.width - maxWidth;
        if (newX < 0) newX = 0;
        if (newY + maxHeight > canvas.height) newY = canvas.height - maxHeight;
        if (newY < 0) newY = 0;

        setLatexPosition({ x: newX, y: newY });
    };

    return (
        <div className="relative w-full h-screen bg-gray-900 flex flex-col">
            {/* Top Bar */}
            <div className="bg-gray-800 p-2 flex justify-between items-center">
                <h1 className="text-white text-xl font-bold">Canvas AI</h1>
                <div className="flex space-x-2">
                    <Button onClick={resetCanvas} className="bg-red-500 hover:bg-red-600 text-white">
                        Reset Canvas
                    </Button>
                    <Button onClick={processImage} className="bg-green-500 hover:bg-green-600 text-white">
                        Process Image
                    </Button>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 relative overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ touchAction: 'none' }}
                />

                {latexExpression && (
                    <Draggable
                        position={latexPosition}
                        onStop={handleDragStop}
                        bounds="parent"
                    >
                            <div
                                id="result-container"
                                className="absolute top-4 right-4 p-4 bg-white rounded-lg shadow-lg border border-gray-300"
                                style={{
                                    width: 'min(90vw, 400px)',
                                    maxHeight: '80vh',
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    touchAction: 'auto',
                                    fontSize: '1rem',
                                    lineHeight: '1.4',
                                    backgroundColor: 'rgba(255, 255, 255, 0.98)'
                                }}
                            >
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                                    <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
                                    <button 
                                        onClick={() => setLatexExpression('')}
                                        className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="text-base p-4 space-y-3">
                                    {latexExpression.split('\n').map((line, i) => (
                                        <div key={i} className={`
                                            ${line.startsWith('•') ? 'pl-4 border-l-4 border-blue-500' : ''}
                                            ${line.startsWith('Problem:') ? 'font-bold text-lg text-blue-700' : ''}
                                            ${line.startsWith('Step') ? 'pl-6 text-gray-700' : ''}
                                            ${line.startsWith('Solution:') ? 'font-bold text-green-600 mt-2' : ''}
                                            ${line.match(/^\d+\./) ? 'font-medium' : ''}
                                        `}>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            </div>
                    </Draggable>
                )}
            </div>

            {/* Bottom Toolbar */}
            <div className="bg-gray-800 p-3 flex flex-col md:flex-row items-center justify-between">
                <div className="flex items-center space-x-4 mb-2 md:mb-0">
                    {/* Color Picker */}
                    <div className="flex space-x-2">
                        {['black', 'white', 'red', 'green', 'blue', 'yellow', 'purple'].map((clr) => (
                            <div
                                key={clr}
                                onClick={() => selectColor(clr)}
                                className="w-8 h-8 rounded-full cursor-pointer border-2 transition-all"
                                style={{ 
                                    backgroundColor: clr, 
                                    borderColor: color === clr ? '#fff' : 'transparent',
                                    transform: color === clr ? 'scale(1.1)' : 'scale(1)'
                                }}
                            />
                        ))}
                    </div>

                    {/* Eraser Controls */}
                    <div className="flex items-center space-x-3">
                        <Button
                            onClick={() => setIsEraserActive(!isEraserActive)}
                            className={isEraserActive ? "bg-yellow-500 hover:bg-yellow-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"}
                        >
                            {isEraserActive ? "✏️ Eraser" : "✏️ Pencil"}
                        </Button>
                        
                        <div className="flex items-center">
                            <input
                                type="range"
                                min="5"
                                max="50"
                                value={eraserSize}
                                onChange={(e) => setEraserSize(e.target.value)}
                                className="w-24 mr-2"
                            />
                            <span className="text-white text-sm">Size: {eraserSize}px</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrawingApp;