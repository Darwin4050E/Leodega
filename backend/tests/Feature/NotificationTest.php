<?php

namespace Tests\Feature;

use App\Enums\NotificationType;
use App\Http\Controllers\NotificationsController;
use App\Models\Notifications;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionClass;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function system_creates_notification_when_event_occurs()
    {
        $sender = User::factory()->create();
        $receiver = User::factory()->create();

        $notification = NotificationService::send(
            $sender->id,
            $receiver->id,
            NotificationType::RESERVATION_BOOKED_AND_PAID,
            'Nueva solicitud',
            'Tienes una nueva solicitud',
            ['test' => true]
        );

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'title' => 'Nueva solicitud',
            'is_read' => false,
        ]);
    }

    /** @test */
    public function user_can_mark_notification_as_read()
    {
        $user = User::factory()->create();

        $notification = Notifications::factory()->create([
            'receiver_id' => $user->id,
            'is_read' => false,
        ]);

        $this->actingAs($user, 'sanctum')
            ->post("/api/notifications/{$notification->id}/read")
            ->assertStatus(200);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => true,
        ]);
    }

    public static function callerRoleProvider(): array
    {
        return [
            'anonymous' => [null],
            'tenant' => ['tenant'],
            'landlord' => ['landlord'],
            'admin' => ['admin'],
        ];
    }

    public static function anonymousRequestProvider(): array
    {
        return [
            'index' => ['GET', '/api/notifications'],
            'unread count' => ['GET', '/api/notifications-unread-count'],
            'mark as read' => ['POST', '/api/notifications/{id}/read'],
        ];
    }

    private function callerAs(?string $role): static
    {
        if ($role === null) {
            return $this;
        }

        return $this->actingAs(User::factory()->create(['role' => $role]), 'sanctum');
    }

    #[DataProvider('callerRoleProvider')]
    public function test_removed_creation_verb_returns_405(?string $role)
    {
        $victim = User::factory()->create();
        Notifications::factory()->create(['receiver_id' => $victim->id, 'is_read' => false]);

        $response = $this->callerAs($role)->postJson('/api/notifications', [
            'receiver_id' => $victim->id,
            'type' => 'reservation_booked_and_paid',
            'title' => 'Forged payment confirmation',
            'data' => ['reservation_id' => 1],
        ]);

        $response->assertStatus(405);
        $this->assertStringContainsString('GET', $response->headers->get('Allow'));
        $this->assertDatabaseCount('notifications', 1);

        $this->actingAs($victim, 'sanctum')
            ->getJson('/api/notifications-unread-count')
            ->assertOk()
            ->assertJson(['count' => 1]);
    }

    #[DataProvider('callerRoleProvider')]
    public function test_removed_patch_read_verb_returns_405(?string $role)
    {
        $victim = User::factory()->create();
        $notification = Notifications::factory()->create([
            'receiver_id' => $victim->id,
            'is_read' => false,
        ]);

        $this->callerAs($role)
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertStatus(405);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => false,
        ]);
    }

    public function test_removed_patch_read_verb_returns_405_for_the_owner()
    {
        $owner = User::factory()->create();
        $notification = Notifications::factory()->create([
            'receiver_id' => $owner->id,
            'is_read' => false,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertStatus(405);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => false,
        ]);
    }

    public function test_only_the_three_notification_routes_are_registered()
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/notifications'))
            ->values();

        $this->assertSame(
            [
                'GET|HEAD api/notifications',
                'GET|HEAD api/notifications-unread-count',
                'POST api/notifications/{notification}/read',
            ],
            $routes
                ->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())
                ->sort()
                ->values()
                ->all()
        );

        foreach ($routes as $route) {
            $this->assertContains('auth.api:sanctum', $route->gatherMiddleware());
        }

        $declared = collect((new ReflectionClass(NotificationsController::class))->getMethods())
            ->filter(fn ($method) => $method->getDeclaringClass()->getName() === NotificationsController::class)
            ->map(fn ($method) => $method->getName())
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['index', 'markAsRead', 'unreadCount'], $declared);
        $this->assertFileDoesNotExist(app_path('Http/Requests/StoreNotificationRequest.php'));
    }

    public function test_index_returns_only_the_callers_notifications_newest_first_max_20()
    {
        $caller = User::factory()->create();
        $other = User::factory()->create();

        $ownIds = [];
        foreach (range(1, 25) as $minutesAgo) {
            $ownIds[] = Notifications::factory()->create([
                'sender_id' => $other->id,
                'receiver_id' => $caller->id,
                'created_at' => now()->subMinutes($minutesAgo),
            ])->id;
        }
        Notifications::factory()->count(3)->create([
            'sender_id' => $caller->id,
            'receiver_id' => $other->id,
            'created_at' => now()->addMinute(),
        ]);

        $response = $this->actingAs($caller, 'sanctum')->getJson('/api/notifications');

        $response->assertOk();
        $this->assertSame(array_slice($ownIds, 0, 20), array_column($response->json(), 'id'));
    }

    public function test_unread_count_counts_only_the_callers_unread()
    {
        $caller = User::factory()->create();
        $other = User::factory()->create();

        Notifications::factory()->count(2)->create(['receiver_id' => $caller->id, 'is_read' => false]);
        Notifications::factory()->create(['receiver_id' => $caller->id, 'is_read' => true]);
        Notifications::factory()->count(3)->create(['receiver_id' => $other->id, 'is_read' => false]);

        $this->actingAs($caller, 'sanctum')
            ->getJson('/api/notifications-unread-count')
            ->assertOk()
            ->assertJson(['count' => 2]);
    }

    public function test_mark_as_read_on_foreign_notification_is_forbidden()
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $notification = Notifications::factory()->create([
            'receiver_id' => $owner->id,
            'is_read' => false,
        ]);

        $this->actingAs($stranger, 'sanctum')
            ->postJson("/api/notifications/{$notification->id}/read")
            ->assertForbidden();

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => false,
        ]);
    }

    #[DataProvider('anonymousRequestProvider')]
    public function test_anonymous_requests_are_unauthorized(string $method, string $uri)
    {
        $notification = Notifications::factory()->create(['is_read' => false]);

        $this->json($method, str_replace('{id}', (string) $notification->id, $uri))
            ->assertUnauthorized();

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => false,
        ]);
    }
}
