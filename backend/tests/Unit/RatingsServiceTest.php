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
}
