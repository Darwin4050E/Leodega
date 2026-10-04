<?php

namespace App\Http\Controllers;

use App\Models\Notifications;

class NotificationsController extends Controller
{
    //
    public function index()
    {
        return Notifications::where('receiver_id', auth()->id())
            ->latest()
            ->limit(20)
            ->get();
    }

    public function markAsRead(Notifications $notification)
    {
        if ($notification->receiver_id !== auth()->id()) {
            abort(403);
        }

        $notification->update(['is_read' => true]);

        return response()->json([
            'message' => 'Notificación marcada como leída',
        ]);
    }

    public function unreadCount()
    {
        $count = Notifications::where('receiver_id', auth()->id())
            ->where('is_read', false)
            ->count();

        return response()->json([
            'count' => $count,
        ]);
    }
}
