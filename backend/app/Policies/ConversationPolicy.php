<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

class ConversationPolicy
{
    /**
     * Formaliza el check manual que antes vivía duplicado en
     * MessageController (authorizeConversation() y el condicional propio de
     * markRead): solo un participante de la conversación puede verla,
     * mandar mensajes o marcarlos como leídos.
     */
    public function view(User $user, Conversation $conversation): bool
    {
        return $conversation->users()->where('user_id', $user->id)->exists();
    }
}
