import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import copy from 'copy-to-clipboard';
import { Button, Input, Upload, message, List, Card, Skeleton } from 'antd';
import { UploadOutlined, DeleteOutlined, PictureOutlined,CopyOutlined } from '@ant-design/icons';

import { Message, imageMessage, Conversation } from './type';
import handleImageUpload from '../api/imageUploadUtils';
import { CozeAPI, ChatEventType, RoleType } from '@coze/api';
import { token, baseURL, bot_id } from '../config/initConfig';
import './ChatDialog.scss';

import { registerMicroApps, start } from 'qiankun';


// 定义微应用信息
const microApps = [
    {
        name: 'micro-app-1',
        entry: '//localhost:8081',
        container: '#micro-app-container',
        activeRule: '/micro-app-1',
    },
    // 可以添加更多微应用
];

// 注册微应用
registerMicroApps(microApps, {
    beforeLoad: (app) => {
        console.log('before load', app);
        return Promise.resolve();
    },
    beforeMount: (app) => {
        console.log('before mount', app);
        return Promise.resolve();
    },
    afterMount: (app) => {
        console.log('after mount', app);
        return Promise.resolve();
    },
    beforeUnmount: (app) => {
        console.log('before unmount', app);
        return Promise.resolve();
    },
    afterUnmount: (app) => {
        console.log('after unmount', app);
        return Promise.resolve();
    },
});

// 启动 qiankun
start();

const { TextArea } = Input;

const ChatDialog = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationIndex, setCurrentConversationIndex] = useState(0);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentConversation = conversations[currentConversationIndex];
    const messages = currentConversation ? currentConversation.messages : [];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileUpload = (info: any) => {
        if (info.file.status === 'done') {
            const selectedFiles = Array.from(info.fileList).map((file: any) => file.originFileObj);
            setFiles([...files, ...selectedFiles]);
        } else if (info.file.status === 'error') {
            message.error(`${info.file.name} 上传失败`);
        }
    };

    const handleSubmit = async () => {
        if (!input.trim() && files.length === 0) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            content: input,
            isUser: true,
            files: [...files],
            imageUrls: [...imageUrls],
        };

        const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: '',
            isUser: false,
            isStreaming: true,
            imageUrls: [...imageUrls],
        };

        const newMessages = [...messages, userMessage, aiMessage];
        const newConversations = [...conversations];
        newConversations[currentConversationIndex] = {
            ...currentConversation,
            messages: newMessages,
        };
        setConversations(newConversations);
        setInput('');
        setFiles([]);

        try {
            setIsLoading(true);
            const client = new CozeAPI({
                token,
                baseURL,
                allowPersonalAccessTokenInBrowser: true,
            });

            const stream = await client.chat.stream({
                bot_id,
                additional_messages: [
                    {
                        role: RoleType.User,
                        content: input,
                        content_type: 'text',
                    },
                ],
            });

            for await (const part of stream) {
                if (part.event === ChatEventType.CONVERSATION_MESSAGE_DELTA) {
                    const updatedMessages = newConversations[currentConversationIndex].messages.map((msg) =>
                        msg.id === aiMessage.id
                            ? { ...msg, content: msg.content + part.data.content, isStreaming: true }
                            : msg
                    );
                    newConversations[currentConversationIndex] = {
                        ...newConversations[currentConversationIndex],
                        messages: updatedMessages,
                    };
                    setConversations([...newConversations]);
                }
            }

            const finalMessages = newConversations[currentConversationIndex].messages.map((msg) =>
                msg.id === aiMessage.id ? { ...msg, isStreaming: false } : msg
            );

            newConversations[currentConversationIndex] = {
                ...newConversations[currentConversationIndex],
                messages: finalMessages,
            };

            setConversations([...newConversations]);
        } catch (error) {
            console.error('API 错误:', error);
            const errorMessages = messages.map((msg) =>
                msg.id === aiMessage.id
                    ? { ...msg, content: '错误: 获取响应失败', isStreaming: false }
                    : msg
            );
            const newConversations = [...conversations];
            newConversations[currentConversationIndex] = {
                ...currentConversation,
                messages: errorMessages,
            };
            setConversations(newConversations);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyMessage = (content: string) => {
        copy(content);
        message.success('信息已经复制成功!');
    };

    const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '');
        const codeContent = String(children).replace(/\n$/, '');
        return !inline && match ? (
            <div className="code-block-wrapper">
                <div className="code-block-header">
                    <span>{match[1]}</span>
                    <Button
                        onClick={() => copy(codeContent)}
                        type="text"
                        icon={<DeleteOutlined />}
                        className="copy-button"
                    >
                        Copy
                    </Button>
                </div>
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                >
                    {codeContent}
                </SyntaxHighlighter>
            </div>
        ) : (
            <code className={className} {...props}>
                {children}
            </code>
        );
    };

    const createNewConversation = () => {
        const newConversation: Conversation = {
            id: Date.now().toString(),
            title: `对话 ${conversations.length + 1}`,
            messages: [],
        };
        setConversations([...conversations, newConversation]);
        setCurrentConversationIndex(conversations.length);
    };

    const extractImageUrls = (content: string) => {
        const regex = /\[.*?\]\((https?:\/\/.*?)\)/g;
        const matches = content.match(regex);
        if (!matches) return [];
        return matches.map((match) => {
            const urlRegex = /\((https?:\/\/.*?)\)/;
            const urlMatch = match.match(urlRegex);
            return urlMatch ? urlMatch[1] : '';
        }).filter((url) => url);
    };

    const handleDeleteConversation = (index: number) => {
        //表示遍历 conversations 数组，对于每个元素，只保留其索引 i 不等于传入的 index 的元素，
        // 从而得到一个不包含要删除对话记录的新数组 newConversations。
        const newConversations = conversations.filter((_, i) => i !== index);
        setConversations(newConversations);
        if (index === currentConversationIndex) {
            if (newConversations.length > 0) {
                setCurrentConversationIndex(0);
            } else {
                setCurrentConversationIndex(-1);
            }
        } else if (index < currentConversationIndex) {
            setCurrentConversationIndex(currentConversationIndex - 1);
        }
    };

    return (
        <div className="app-container">
            <div className="conversation-list">
                <Button onClick={createNewConversation} type="primary">
                    创建新对话
                </Button>
                <List
                    dataSource={conversations}
                    renderItem={(conversation, index) => (
                        // 删除按钮
                        <List.Item
                            className={`conversation-item ${index === currentConversationIndex ? 'active' : ''}`}
                            onClick={() => setCurrentConversationIndex(index)}
                        >
                            <span>{conversation.title}</span>
                            <Button
                                onClick={() => handleDeleteConversation(index)}
                                type="text"
                                icon={<DeleteOutlined />}
                                className="delete-button"
                            />
                        </List.Item>
                    )}
                />
            </div>
            <div className="chat-container">
                <div className="messages-container">
                    <List
                        dataSource={messages}
                        renderItem={(message) => (
                            <List.Item
                                className={`message ${message.isUser ? 'user' : 'ai'}`}
                                key={message.id}
                            >
                                {message.files?.map((file, index) => (
                                    <div key={index} className="file-preview">
                                        {file.type.startsWith('image/') ? (
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt={file.name}
                                                className="preview-image"
                                            />
                                        ) : (
                                            <div className="file-info">
                                                <span>{file.name}</span>
                                                <span>{Math.round(file.size / 1024)} KB</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="message-content">
                                    {!message.isUser ? (
                                        <>
                                            <ReactMarkdown
                                                components={{
                                                    code: CodeBlock,
                                                    img: ({ node, ...props }) => (
                                                        <img {...props} style={{ maxWidth: '100%' }} />
                                                    ),
                                                }}
                                            >
                                                {message.content + (message.isStreaming ? '▍' : '')}
                                            </ReactMarkdown>
                                            {extractImageUrls(message.content).map((url, index) => (
                                                <img
                                                    key={index}
                                                    src={url}
                                                    alt="Generated Image"
                                                    style={{ maxWidth: '100%', marginTop: '10px' }}
                                                />
                                            ))}
                                        </>
                                    ) : (
                                        <div className="user-content">
                                            {message.content}
                                        </div>
                                    )}
                                    <Button
                                        onClick={() => handleCopyMessage(message.content)}
                                        type="text"
                                        icon={<CopyOutlined />}
                                        className="copy-button"
                                    >
                                        复制
                                    </Button>
                                </div>
                            </List.Item>
                        )}
                    />
                    <div ref={messagesEndRef} />
                </div>
                <div className="input-container">
                    <div className="upload-section">
                        <Upload
                            accept="image/*"
                            multiple
                            beforeUpload={() => false}
                            onChange={(e:any) => handleImageUpload(e, setIsLoading, setImageUrls)}
                        >
                            <Button icon={<PictureOutlined />} className="upload-button">
                                📷 上传图片
                            </Button>
                        </Upload>
                        {imageUrls.map((url, index) => (
                            <div key={index} className="image-preview">
                                <img
                                    src={url}
                                    alt="预览"
                                    style={{ maxHeight: 50, marginRight: 5 }}
                                />
                                <Button
                                    icon={<DeleteOutlined />}
                                    className="remove-button"
                                    onClick={() => setImageUrls(imageUrls.filter((_, i) => i !== index))}
                                />
                            </div>
                        ))}
                        <Upload
                            multiple
                            beforeUpload={() => false}
                            onChange={handleFileUpload}
                        >
                            <Button icon={<UploadOutlined />} className="upload-button">
                                📎 上传文件
                            </Button>
                        </Upload>
                        {files.map((file, index) => (
                            <span key={index} className="file-tag">
                                {file.name}
                                <Button
                                    icon={<DeleteOutlined />}
                                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                                />
                            </span>
                        ))}
                    </div>
                    <div className="text-input">
                        <TextArea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="请在此输入你的想法吧！"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            disabled={isLoading}
                        />
                        <Button onClick={handleSubmit} type="primary" disabled={isLoading}>
                            {isLoading ? <Skeleton active paragraph={false} /> : 'Send'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatDialog;