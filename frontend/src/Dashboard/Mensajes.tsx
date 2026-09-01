import { useEffect, useRef, useState } from "react";
import {
    getMe,
    getConversations,
    getMessages,
    markConversationRead,
    sendMessage as sendMessageRequest,
    createConversation,
} from "../services/conversations";
import { getUsers } from "../services/users";
import { Send, Plus, Search, Paperclip, X } from "lucide-react";

interface User {
    id: number;
    name: string;
    lastname: string;
}

interface Message {
    id: number;
    body: string | null;
    sender_id: number;
    created_at: string;
    sender: User;
    file_path?: string;
    file_type?: string;
    file_name?: string;
}

interface Conversation {
    id: number;
    users: User[];
    last_message?: Message;
    unread_count: number;
}

const Mensajes = () => {
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [showNewChat, setShowNewChat] = useState(false);
    const [search, setSearch] = useState("");

    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    /* ================= LOADERS ================= */

    const loadAuthUser = async () => {
        const res = await getMe();
        setAuthUser(res.data.user);
    };

    const loadConversations = async () => {
        const res = await getConversations();
        setConversations(res.data);
    };

    const loadMessages = async (id: number) => {
        const res = await getMessages(id);
        setMessages(res.data.data);
    };

    const loadUsers = async () => {
        const res = await getUsers();
        setUsers(res.data);
    };

    /* ================= FILE ================= */

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        setFile(selected);

        if (selected.type.startsWith("image/")) {
            setPreview(URL.createObjectURL(selected));
        } else {
            setPreview(null);
        }
    };

    const removeFile = () => {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    /* ================= ACTIONS ================= */

    const openConversation = async (conv: Conversation) => {
        setActiveConversation(conv);
        await loadMessages(conv.id);
        await markConversationRead(conv.id);
        loadConversations();
    };

    const sendMessage = async () => {
        if (!activeConversation) return;
        if (!messageText.trim() && !file) return;

        const formData = new FormData();
        formData.append("body", messageText);
        if (file) formData.append("file", file);

        await sendMessageRequest(activeConversation.id, formData);

        setMessageText("");
        removeFile();
        loadMessages(activeConversation.id);
        loadConversations();
    };

    const startConversation = async (userId: number) => {
        const res = await createConversation(userId);
        setShowNewChat(false);
        setActiveConversation(res.data);
        loadMessages(res.data.id);
        loadConversations();
    };

    /* ================= EFFECTS ================= */

    useEffect(() => {
        loadAuthUser();
        loadConversations();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /* ================= FILTER ================= */

    const filteredConversations = conversations.filter(conv => {
        const otherUser = conv.users.find(u => u.id !== authUser?.id);
        return `${otherUser?.name} ${otherUser?.lastname}`
            .toLowerCase()
            .includes(search.toLowerCase());
    });

    /* ================= UI ================= */

    return (
        <div className="flex h-screen bg-gray-100">

            {/* SIDEBAR */}
            <div className="w-1/4 bg-white border-r flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-bold text-lg">Chats</h2>
                    <button onClick={() => { setShowNewChat(true); loadUsers(); }}>
                        <Plus />
                    </button>
                </div>

                <div className="p-2 border-b">
                    <div className="flex items-center bg-gray-100 rounded px-2">
                        <Search size={16} />
                        <input
                            className="bg-transparent flex-1 px-2 py-1 outline-none text-sm"
                            placeholder="Buscar chat..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConversations.map(conv => {
                        const otherUser = conv.users.find(u => u.id !== authUser?.id);
                        return (
                            <div
                                key={conv.id}
                                onClick={() => openConversation(conv)}
                                className={`px-4 py-3 border-b cursor-pointer flex gap-3
                                    ${conv.unread_count > 0 ? "bg-blue-50" : "hover:bg-gray-100"}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                                    {otherUser?.name.charAt(0)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">
                                        {otherUser?.name} {otherUser?.lastname}
                                    </p>
                                    {conv.last_message && (
                                        <p className="text-sm truncate text-gray-500">
                                            {conv.last_message.sender_id === authUser?.id && "Tú: "}
                                            {conv.last_message.body ?? "📎 Archivo"}
                                        </p>
                                    )}
                                </div>

                                {conv.unread_count > 0 && (
                                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                        {conv.unread_count}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CHAT */}
            <div className="flex-1 flex flex-col">
                {!activeConversation ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Selecciona una conversación
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b bg-white font-semibold">Chat</div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`max-w-[70%] px-3 py-2 rounded-lg text-sm
                                        ${msg.sender_id === authUser?.id
                                            ? "bg-blue-500 text-white ml-auto"
                                            : "bg-gray-200"}`}
                                >
                                    {msg.file_path && msg.file_type?.startsWith("image/") && (
                                        <img
                                            src={msg.file_path}
                                            alt=""
                                            className="rounded mb-1 max-h-60"
                                        />
                                    )}

                                    {msg.file_path && !msg.file_type?.startsWith("image/") && (
                                        <a
                                            href={msg.file_path}
                                            target="_blank"
                                            className="text-blue-700 underline block mb-1"
                                        >
                                            📎 {msg.file_name}
                                        </a>
                                    )}

                                    {msg.body}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {file && (
                            <div className="px-4 py-2 bg-gray-100 flex items-center gap-3 border-t">
                                {preview ? (
                                    <img src={preview} className="h-20 rounded" />
                                ) : (
                                    <span className="text-sm">📎 {file.name}</span>
                                )}
                                <button onClick={removeFile}>
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        <div className="p-3 border-t bg-white flex items-center gap-2">
                            <button onClick={() => fileInputRef.current?.click()}>
                                <Paperclip />
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                hidden
                                onChange={handleFileChange}
                            />

                            <input
                                className="flex-1 bg-gray-100 rounded-full px-4 py-2 outline-none"
                                placeholder="Escribe un mensaje..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                            />

                            <button
                                onClick={sendMessage}
                                className="bg-blue-600 text-white p-3 rounded-full"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* MODAL */}
            {showNewChat && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white w-96 rounded p-4">
                        <h3 className="font-bold mb-3">Nuevo chat</h3>
                        {users.filter(u => u.id !== authUser?.id).map(u => (
                            <div
                                key={u.id}
                                onClick={() => startConversation(u.id)}
                                className="p-2 border-b cursor-pointer hover:bg-gray-100"
                            >
                                {u.name} {u.lastname}
                            </div>
                        ))}
                        <button onClick={() => setShowNewChat(false)} className="mt-3 text-red-500">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Mensajes;
