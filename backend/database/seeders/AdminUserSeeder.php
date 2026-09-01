<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@leodega.com'],
            [
                'name' => 'Administrador',
                'lastname' => 'Leodega',
                'phone' => '0999999999',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
            ]
        );
    }
}
