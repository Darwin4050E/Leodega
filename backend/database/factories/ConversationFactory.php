<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ConversationFactory extends Factory
{
    protected $model = Conversation::class;

    public function definition(): array
    {
        return [];
    }

    /**
     * Adjunta dos usuarios a la conversación
     */
    public function withUsers(User $userA, User $userB)
    {
        return $this->afterCreating(function (Conversation $conversation) use ($userA, $userB) {
            $conversation->users()->attach([
                $userA->id,
                $userB->id,
            ]);
        });
    }
}
