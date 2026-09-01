<?php

namespace App\Http\Controllers;

use App\Enums\NotificationType;
use App\Http\Requests\StoreMessageRequest;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class MessageController extends Controller
{
    // Mensajes de una conversación
    public function index(Conversation $conversation)
    {
        Gate::authorize('view', $conversation);

        return $conversation
            ->messages()
            ->with('sender:id,name')
            ->orderBy('created_at', 'asc')
            ->paginate(20);
    }

    // Enviar mensaje
    public function store(StoreMessageRequest $request, Conversation $conversation)
    {
        Gate::authorize('view', $conversation);

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => auth()->id(),
            'body' => $request->body,
        ]);

        $conversation->users
            ->where('id', '!=', auth()->id())
            ->each(function ($user) use ($conversation, $message) {
                NotificationService::send(
                    auth()->id(),          // quien envía
                    $user->id,             // quien recibe
                    NotificationType::MESSAGE,
                    'Nuevo mensaje',
                    Str::limit($message->body, 50),
                    [
                        'conversation_id' => $conversation->id,
                        'message_id' => $message->id,
                    ]
                );
            });

        return $message;

    }

    // Marcar mensajes como leídos
    public function markRead(Conversation $conversation)
    {
        Gate::authorize('view', $conversation);

        Message::where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', auth()->id())
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['ok' => true]);
    }
}
