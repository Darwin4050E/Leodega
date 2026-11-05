<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportEvidences extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_id',
        'file_path',
        'file_type',
    ];

    /**
     * @return BelongsTo<Reports, $this>
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Reports::class, 'report_id');
    }
}
