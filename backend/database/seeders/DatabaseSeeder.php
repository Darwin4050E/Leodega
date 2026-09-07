<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(AdminUserSeeder::class);

        // Demo accounts, listings and reservations for local dev / staging.
        // Kept out of production so it never seeds fake data into a real DB.
        if (! app()->environment('production')) {
            $this->call(DemoDataSeeder::class);
        }
    }
}
