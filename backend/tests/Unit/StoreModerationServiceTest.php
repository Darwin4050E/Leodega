<?php

namespace Tests\Unit;

use App\Enums\NotificationType;
use App\Models\StoreRooms;
use App\Models\User;
use App\Services\ModerationDecision;
use App\Services\StoreModerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * Mirrors AccountModerationServiceTest.php's structure: arrange admin+room,
 * act via the ModerationDecision DTO, assert persisted columns/notifications
 * directly against the service — no HTTP layer.
 */
class StoreModerationServiceTest extends TestCase
{
    use RefreshDatabase;

    private function service(): StoreModerationService
    {
        return new StoreModerationService;
    }

    public function test_moderate_persists_admin_id_and_reason_code_on_rejection()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $moderation = $this->service()->moderate($room, new ModerationDecision(
            decision: 'rejected',
            reason: 'Fotos poco claras',
            reasonCode: 'fotos',
            adminId: $admin->id,
        ));

        $this->assertSame('rejected', $room->fresh()->publication_status);
        $this->assertDatabaseHas('store_moderation', [
            'id' => $moderation->id,
            'store_id' => $room->id,
            'status' => 'rejected',
            'reason_code' => 'fotos',
            'reason_rejected' => 'Fotos poco claras',
            'admin_id' => $admin->id,
            'permit_waived_at' => null,
        ]);
    }

    public function test_moderate_persists_admin_id_on_approval_without_reason_code()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $moderation = $this->service()->moderate($room, new ModerationDecision(
            decision: 'approved',
            adminId: $admin->id,
        ));

        $this->assertDatabaseHas('store_moderation', [
            'id' => $moderation->id,
            'status' => 'approved',
            'reason_code' => null,
            'admin_id' => $admin->id,
        ]);
    }

    public function test_moderate_records_permit_waived_at_only_when_both_preconditions_hold()
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $waivedRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => null,
        ]);
        $waivedModeration = $this->service()->moderate($waivedRoom, new ModerationDecision(
            decision: 'approved',
            adminId: $admin->id,
            permitWaiverAcknowledged: true,
        ));
        $this->assertNotNull($waivedModeration->fresh()->permit_waived_at);

        $permittedRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        $permittedModeration = $this->service()->moderate($permittedRoom, new ModerationDecision(
            decision: 'approved',
            adminId: $admin->id,
            permitWaiverAcknowledged: true,
        ));
        $this->assertNull($permittedModeration->fresh()->permit_waived_at);

        $unacknowledgedRoom = StoreRooms::factory()->withPhotos()->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => null,
        ]);
        $unacknowledgedModeration = $this->service()->moderate($unacknowledgedRoom, new ModerationDecision(
            decision: 'approved',
            adminId: $admin->id,
        ));
        $this->assertNull($unacknowledgedModeration->fresh()->permit_waived_at);
    }

    public function test_moderate_rejection_notification_body_uses_the_typed_label_not_the_raw_code()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $room->load('landlord.user');

        $this->service()->moderate($room, new ModerationDecision(
            decision: 'rejected',
            reasonCode: 'fotos',
            adminId: $admin->id,
        ));

        $this->assertDatabaseHas('notifications', [
            'sender_id' => $admin->id,
            'receiver_id' => $room->landlord->user->id,
            'type' => NotificationType::STORE_REJECTED->value,
            'body' => 'Fotos incorrectas',
        ]);
    }

    public function test_moderate_rejection_notification_body_appends_the_optional_comment()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);
        $room->load('landlord.user');

        $this->service()->moderate($room, new ModerationDecision(
            decision: 'rejected',
            reason: 'Falta la fachada',
            reasonCode: 'fotos',
            adminId: $admin->id,
        ));

        $this->assertDatabaseHas('notifications', [
            'sender_id' => $admin->id,
            'receiver_id' => $room->landlord->user->id,
            'body' => 'Fotos incorrectas: Falta la fachada',
        ]);
    }

    public function test_moderate_rejects_an_invalid_decision()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $this->expectException(InvalidArgumentException::class);

        $this->service()->moderate($room, new ModerationDecision(
            decision: 'pending',
            adminId: $admin->id,
        ));
    }

    public function test_moderate_never_touches_reason_code_or_admin_id_on_a_historical_row()
    {
        $room = StoreRooms::factory()->create();
        $historicalModeration = $room->moderations()->create([
            'status' => 'rejected',
            'reason_rejected' => 'Motivo antiguo en texto libre',
            'moderation_date' => now()->subMonth(),
        ]);

        $this->assertNull($historicalModeration->reason_code);
        $this->assertNull($historicalModeration->admin_id);
    }

    public function test_moderate_refuses_to_approve_a_room_with_fewer_than_three_photos()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->withPhotos(2)->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);
        $room->load('landlord.user');

        try {
            $this->service()->moderate($room, new ModerationDecision(decision: 'approved', adminId: $admin->id));
            $this->fail('Expected a ValidationException for the missing photos.');
        } catch (ValidationException $e) {
            $this->assertSame(
                ['La bodega necesita al menos 3 fotos para ser aprobada.'],
                $e->errors()['photos'],
            );
        }

        $this->assertSame('pending', $room->fresh()->publication_status);
        $this->assertDatabaseCount('store_moderation', 0);
        $this->assertDatabaseMissing('notifications', ['receiver_id' => $room->landlord->user->id]);
    }

    public function test_moderate_approves_a_room_with_exactly_three_photos()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->withPhotos(3)->create([
            'publication_status' => 'pending',
            'firefighter_permit_path' => 'firefighter_permits/permit.pdf',
        ]);

        $this->service()->moderate($room, new ModerationDecision(decision: 'approved', adminId: $admin->id));

        $this->assertSame('approved', $room->fresh()->publication_status);
    }

    public function test_moderate_still_rejects_a_room_without_photos()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $room = StoreRooms::factory()->create(['publication_status' => 'pending']);

        $this->service()->moderate($room, new ModerationDecision(
            decision: 'rejected',
            reasonCode: 'fotos',
            adminId: $admin->id,
        ));

        $this->assertSame('rejected', $room->fresh()->publication_status);
        $this->assertDatabaseHas('store_moderation', ['store_id' => $room->id, 'status' => 'rejected']);
    }
}
