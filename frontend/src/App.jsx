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
            ctx.globalCompositeOperation = 'destination-out';
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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

            const prompt = `You have been given an image with some mathematical expressions, equations, or graphical problems, and you need to solve them In details explain every thing how to solve that question and give them the solution. Note: Use the PEMDAS rule for solving mathematical expressions. PEMDAS stands for the Priority Order: Parentheses, Exponents, Multiplication and Division (from left to right), Addition and Subtraction (from left to right). Parentheses have the highest priority, followed by Exponents, then Multiplication and Division, and lastly Addition and Subtraction. For example: Q. 2 + 3 * 4 (3 * 4) => 12, 2 + 12 = 14. Q. 2 + 3 + 5 * 4 - 8 / 2 5 * 4 => 20, 8 / 2 => 4, 2 + 3 => 5, 5 + 20 => 25, 25 - 4 => 21. YOU CAN HAVE FIVE TYPES OF EQUATIONS/EXPRESSIONS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: Following are the cases: 1. Simple mathematical expressions like 2 + 2, 3 * 4, 5 / 6, 7 - 8, etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{"expr": given expression, "result": calculated answer}]. 2. Set of Equations like x^2 + 2x + 1 = 0, 3y + 4x = 0, 5x^2 + 6y + 7 = 12, etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {"expr": "x", "result": 2, "assign": True} and dict 2 as {"expr": "y", "result": 5, "assign": True}.
             This example assumes x was calculated as 2, and y as 5. Include as many dicts as there are variables. 3. Assigning values to variables like x = 4, y = 5, z = 6, etc.: In this case, assign values to variables and return another key in the dict called {"assign": True}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. 4. Analyzing Graphical Math problems, which are word problems represented in drawing form, such as cars colliding, trigonometric problems, problems on the Pythagorean theorem, adding runs from a cricket wagon wheel, etc.
              These will have a drawing representing some scenario and accompanying information with the image. PAY CLOSE ATTENTION TO DIFFERENT COLORS FOR THESE PROBLEMS. You need to return the answer in the format of a LIST OF ONE DICT [{"expr": given expression, "result": calculated answer}]. 5. Detecting Abstract Concepts that a drawing might show, such as love, hate, jealousy, patriotism, or a historic reference to war, invention, discovery, quote, etc. USE THE SAME FORMAT AS OTHERS TO RETURN THE ANSWER, where 'expr' will be the explanation of the drawing, and 'result' will be the abstract concept. Analyze the equation or expression in this image and return the answer according to the given rules: Make sure to use extra backslashes for escape characters like  etc. Here is a dictionary of user-assigned variables. If the given expression has any of these variables, use its actual value from this dictionary accordingly: {}. DO NOT USE BACKTICKS OR MARKDOWN FORMATTING. PROPERLY QUOTE THE KEYS AND VALUES IN THE DICTIONARY FOR EASIER PARSING WITH Python's ast.literal_eval.`;

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
        <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
        <div className="absolute bottom-0 left-0 z-10 p-4 space-x-4 flex flex-wrap items-center">
                <Button onClick={resetCanvas} className="bg-red-500 text-white">
                    Reset
                </Button>
                <Button onClick={processImage} className="bg-green-500 text-white">
                    Process
                </Button>
            </div>

            <div className="absolute bottom-16 left-0 z-10 p-4 space-x-4 flex flex-col md:flex-row items-center">
                <div className="flex space-x-2 overflow-x-auto">
                    {['white', 'red', 'green', 'blue', 'yellow', 'purple'].map((clr) => (
                        <div
                            key={clr}
                            onClick={() => selectColor(clr)}
                            className="w-6 h-6 cursor-pointer"
                            style={{ backgroundColor: clr, border: color === clr ? '2px solid #fff' : 'none' }}
                        />
                    ))}
                </div>

                <div className="flex items-center mt-2 md:mt-0">
                    <input
                        type="range"
                        min="5"
                        max="100"
                        value={eraserSize}
                        onChange={(e) => setEraserSize(e.target.value)}
                        className="mx-2"
                    />
                    <span className="text-white">Eraser Size: {eraserSize}px</span>
                </div>

                <Button
                    onClick={() => {
                        setIsEraserActive(!isEraserActive);
                    }}
                    className={isEraserActive ? "bg-yellow-500 text-white" : "bg-gray-700 text-white"}
                >
                    {isEraserActive ? "Eraser Active" : "Activate Eraser"}
                </Button>
            </div>

            <canvas
                ref={canvasRef}
                className="absolute top-0 w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                    height: window.innerHeight < 600 ? '400px' : '100vh',
                    touchAction: 'none'
                }}
            />

            {latexExpression && (
                <Draggable
                    position={latexPosition}
                    onStop={handleDragStop}
                    bounds="parent"
                >
                    <div
                        id="result-container"
                        className="absolute p-4 bg-white rounded shadow-lg"
                        style={{
                            width: Math.min(300, window.innerWidth - 20) + 'px',
                            maxHeight: Math.min(300, window.innerHeight - 20) + 'px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            touchAction: 'auto'
                        }}
                    >
                        <div className="latex-content" style={{ whiteSpace: 'pre-wrap' }}>
                            {latexExpression}
                        </div>
                    </div>
                </Draggable>
            )}
        </div>
    );
};

export default DrawingApp;