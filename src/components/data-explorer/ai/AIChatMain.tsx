import { useState, useRef, useEffect } from 'react';
import { Send, Copy, Check, Plus, Mic, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    files?: string[]; // just mock file names for display in message
}

export function AIChatMain({ aiContextTable, aiContextSchema }: { aiContextTable?: string | null; aiContextSchema?: string }) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Feature States
    const [isListening, setIsListening] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + transcript);

                if (textareaRef.current) {
                    textareaRef.current.style.height = '52px';
                    setTimeout(() => {
                        if (textareaRef.current) {
                            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
                        }
                    }, 0);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSend = () => {
        if ((!input.trim() && attachedFiles.length === 0) || isTyping) return;

        const fileNames = attachedFiles.map(f => f.name);
        const newUserMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            files: fileNames.length > 0 ? fileNames : undefined
        };

        setMessages(prev => [...prev, newUserMsg]);
        setInput('');
        setAttachedFiles([]);
        setIsTyping(true);
        setIsListening(false);
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }

        // Reset textarea height after sending
        if (textareaRef.current) {
            textareaRef.current.style.height = '52px';
        }

        // Mock response
        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm a mockup interface right now, but soon I'll be able to help you build queries, analyze performance, and generate schemas!"
            }]);
        }, 1500);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        if (e.target) {
            e.target.style.height = '52px';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
        }
    };

    return (
        <main className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
            {/* Header */}
            <div className="h-14 flex items-center px-6 shrink-0 bg-background/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Resona AI
                    </h2>
                    {aiContextTable && (
                        <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[11px] font-medium ml-2">
                            @{aiContextSchema || 'public'}.{aiContextTable}
                        </span>
                    )}
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto pb-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="max-w-3xl mx-auto w-full px-4 pt-4 pb-32 flex flex-col gap-6">
                    {messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center mt-24">
                            <img src="/resona.png" alt="Resona AI" className="w-10 h-10 mb-3 object-contain" />
                            <h3 className="text-2xl font-semibold text-foreground">How can I help you today?</h3>
                            <p className="text-sm text-muted-foreground mt-2">Ask anything about your data.</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className={cn("flex gap-4 w-full group", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0 border border-border/50 shadow-sm mt-0.5">
                                        <img src="/resona.png" alt="AI" className="w-4 h-4 object-contain" />
                                    </div>
                                )}
                                <div className={cn(
                                    "relative flex flex-col gap-1 max-w-[80%]",
                                    msg.role === 'user' ? "items-end" : "items-start"
                                )}>
                                    <div className={cn(
                                        "text-[15px] px-4 py-2.5 rounded-3xl whitespace-pre-wrap leading-relaxed shadow-sm flex flex-col gap-2",
                                        msg.role === 'user'
                                            ? "bg-secondary text-secondary-foreground"
                                            : "bg-transparent text-foreground shadow-none px-0"
                                    )}>
                                        {/* Display mock attached files in user bubble */}
                                        {msg.role === 'user' && msg.files && msg.files.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-1">
                                                {msg.files.map((fileName, i) => (
                                                    <div key={i} className="flex items-center gap-1.5 bg-background/50 border border-border/50 rounded-lg px-2.5 py-1.5 text-xs">
                                                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                                                        <span className="truncate max-w-[120px]">{fileName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {msg.content}
                                    </div>
                                    <div className={cn(
                                        "flex items-center opacity-0 group-hover:opacity-100 transition-opacity",
                                        msg.role === 'user' ? "justify-end pr-1" : "justify-start"
                                    )}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleCopy(msg.id, msg.content)}
                                        >
                                            {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {isTyping && (
                        <div className="flex gap-4 w-full justify-start">
                            <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0 border border-border/50 shadow-sm mt-0.5">
                                <img src="/resona.png" alt="AI" className="w-4 h-4 object-contain" />
                            </div>
                            <div className="flex items-center gap-1 h-8 px-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-2 pb-4 px-4">
                <div className="max-w-3xl mx-auto relative group">
                    <div className="relative flex flex-col w-full bg-card border border-border/80 rounded-2xl shadow-sm focus-within:border-border transition-colors">

                        {/* Selected Files Preview Area */}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 max-h-[100px] overflow-y-auto">
                                {attachedFiles.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-lg pl-2 pr-1 py-1 text-xs text-foreground group/file">
                                        <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30">
                                            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span className="truncate max-w-[100px] font-medium">{file.name}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 rounded-full hover:bg-background text-muted-foreground opacity-50 group-hover/file:opacity-100"
                                            onClick={() => removeFile(i)}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative flex items-end w-full">
                            <div className="absolute left-2 bottom-2 flex items-center justify-center p-0.5 z-10">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    multiple
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground rounded-full hover:bg-muted font-light"
                                    onClick={triggerFileSelect}
                                >
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </div>

                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder="Message Resona AI..."
                                className="w-full min-h-[52px] resize-none border-0 focus-visible:outline-none focus:ring-0 py-3.5 pl-12 pr-24 bg-transparent text-[15px] shadow-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full"
                                rows={1}
                            />

                            <div className="absolute right-2 bottom-2 flex items-center gap-1 z-10">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 rounded-full transition-colors",
                                        isListening ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 bg-red-50 dark:bg-red-900/10 animate-pulse" : "text-muted-foreground hover:bg-muted"
                                    )}
                                    onClick={toggleListening}
                                >
                                    <Mic className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    onClick={handleSend}
                                    disabled={(!input.trim() && attachedFiles.length === 0) || isTyping}
                                    className={cn(
                                        "h-8 w-8 rounded-full transition-all duration-200",
                                        (input.trim() || attachedFiles.length > 0) ? "bg-foreground hover:bg-foreground/90 text-background" : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="text-center mt-2 pb-1">
                        <span className="text-xs text-muted-foreground/70">Resona AI can make mistakes. Consider verifying important information.</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
