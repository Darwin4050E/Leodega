<?php

namespace Tests\Unit;

use App\Exceptions\DuplicateRatingException;
use App\Models\Ratings;
use App\Models\StoreRooms;
use App\Models\User;
use App\Services\RatingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RatingsServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_persists_a_rating()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        $rating = (new RatingsService)->create($user, [
            'store_id' => $storeRoom->id,
            'stars' => 4,
            'comment' => 'Buena ubicación',
        ]);

        $this->assertDatabaseHas('ratings', [
            'id' => $rating->id,
            'store_id' => $storeRoom->id,
            'user_id' => $user->id,
            'stars' => 4,
        ]);
    }

    public function test_create_throws_when_user_already_rated_the_store_room()
    {
        $user = User::factory()->create();
        $storeRoom = StoreRooms::factory()->create();

        Ratings::factory()->create([
            'store_id' => $storeRoom->id,
            'user_id' => $user->id,
        ]);

        $this->expectException(DuplicateRatingException::class);

        (new RatingsService)->create($user, [
            'store_id' => $storeRoom->id,
            'stars' => 2,
            'comment' => 'Otra vez',
        ]);
    }

    public function test_summary_for_returns_average_and_count_when_ratings_exist()
    {
        $storeRoom = StoreRooms::factory()->create();

        Ratings::factory()->create(['store_id' => $storeRoom->id, 'stars' => 4]);
        Ratings::factory()->create(['store_id' => $storeRoom->id, 'stars' => 2]);

        $summary = (new RatingsService)->summaryFor($storeRoom->id);

        $this->assertSame(3.0, $summary['avg']);
        $this->assertSame(2, $summary['count']);
    }

    /**
     * Eloquent's avg() returns NULL with zero matching rows, and PHP 8.1+
     * deprecates round(null, ...). summaryFor() must guard against this so
     * the notice never resurfaces (see Engram obs #221).
     */
    public function test_summary_for_returns_zero_avg_and_count_without_deprecation_notice()
    {
        $storeRoom = StoreRooms::factory()->create();

        $errorLevel = error_reporting(E_ALL);

        try {
            $summary = (new RatingsService)->summaryFor($storeRoom->id);
        } finally {
            error_reporting($errorLevel);
        }

        $this->assertSame(0.0, $summary['avg']);
        $this->assertSame(0, $summary['count']);
    }
}
