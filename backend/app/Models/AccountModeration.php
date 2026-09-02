<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccountModeration extends Model
{
    use HasFactory;

    protected $table = 'account_moderation';

    protected $fillable = [
        'user_id',
        'admin_id',
        'action',
        'reason',
        'moderation_date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
