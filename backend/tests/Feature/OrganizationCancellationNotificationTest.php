<?php

namespace Tests\Feature;

use App\Enums\NotificationType;
use App\Models\Notifications;
use App\Models\Reservations;
use App\Models\StoreRooms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsOrganizationCancellationScenario;
use Tests\TestCase;

/**
 * HUE-06 U1b OR-24: an admin cancel of an organization reservation notifies the
 * gestor and every member of the organization except the actor, in app and
 * inside the cancel transaction.
 */
class OrganizationCancellationNotificationTest extends TestCase
{
    use BuildsOrganizationCancellationScenario;
    use RefreshDatabase;

    private const REASON = 'Cambio de planes internos';

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->buildScenario();
    }

    private function receiverIds(): array
    {
        return Notifications::pluck('receiver_id')->sort()->values()->all();
    }

    private function inboxOf($user): Notifications
    {
        return Notifications::where('receiver_id', $user->id)->sole();
    }

    public function test_the_gestor_and_every_member_except_the_actor_are_notified()
    {
        $this->cancel($this->paidReservation(), $this->admin, self::REASON)->assertOk();

        $expected = collect([$this->gestor->id, $this->creator->id, $this->otherMember->id])->sort()->values()->all();
        $this->assertSame($expected, $this->receiverIds());
    }

    public function test_a_creator_who_is_the_acting_admin_is_not_notified_but_the_other_members_are()
    {
        $reservation = $this->paidReservation('100.00', 'moderada', ['tenant_id' => $this->admin->tenant->id]);

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $expected = collect([$this->gestor->id, $this->creator->id, $this->otherMember->id])->sort()->values()->all();
        $this->assertSame($expected, $this->receiverIds());
    }

    public function test_an_organization_whose_only_member_is_the_actor_notifies_only_the_gestor()
    {
        $reservation = $this->paidReservation();
        $this->organization->users()->detach([$this->creator->id, $this->otherMember->id]);

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $this->assertSame([$this->gestor->id], $this->receiverIds());
    }

    public function test_each_notification_carries_the_type_the_sender_and_the_reservation_data()
    {
        $reservation = $this->paidReservation();

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $this->assertCount(3, Notifications::all());
        foreach (Notifications::all() as $notification) {
            $this->assertSame(NotificationType::RESERVATION_CANCELED->value, $notification->type);
            $this->assertSame($this->admin->id, $notification->sender_id);
            $this->assertEqualsCanonicalizing(['reservation_id', 'store_room_id', 'organization_id'], array_keys($notification->data));
            $this->assertSame($reservation->id, $notification->data['reservation_id']);
            $this->assertSame($reservation->store_room_id, $notification->data['store_room_id']);
            $this->assertSame($this->organization->id, $notification->data['organization_id']);
        }
    }

    public function test_the_gestor_text_names_the_organization_and_omits_the_reason()
    {
        $reservation = $this->paidReservation();

        $this->cancel($reservation, $this->admin, self::REASON)->assertOk();

        $gestorNotice = $this->inboxOf($this->gestor);
        $this->assertSame('Reserva cancelada por la organización', $gestorNotice->title);
        $this->assertSame(
            "Andina canceló la reserva de {$reservation->storeRooms->title}. Revisa el reembolso correspondiente.",
            $gestorNotice->body
        );
        $this->assertStringNotContainsString(self::REASON, $gestorNotice->body);
    }

    public function test_the_member_text_names_the_actor_the_room_the_creator_and_the_reason()
    {
        $reservation = $this->paidReservation();

        $this->cancel($reservation, $this->admin, '  '.self::REASON.'  ')->assertOk();

        foreach ([$this->creator, $this->otherMember] as $member) {
            $notice = $this->inboxOf($member);
            $this->assertSame('Reserva de la organización cancelada', $notice->title);
            $this->assertSame(
                "{$this->admin->name} canceló la reserva de {$reservation->storeRooms->title} reservada por {$this->creator->name}. Motivo: ".self::REASON,
                $notice->body
            );
        }
    }

    public function test_a_rejected_cancel_creates_no_notification()
    {
        $reservation = $this->paidReservation();
        $ineligible = $this->paidReservation('100.00', 'moderada', ['start_date' => now()->toDateString()]);

        $this->cancel($reservation, $this->creator, self::REASON)->assertStatus(403);
        $this->cancel($reservation, $this->admin, 'corto')->assertStatus(422);
        $this->cancel($ineligible, $this->admin, self::REASON)->assertStatus(409);

        $this->assertCount(0, Notifications::all());
    }

    public function test_a_personal_cancel_keeps_its_single_unchanged_gestor_notification()
    {
        $personal = Reservations::factory()->create([
            'store_room_id' => StoreRooms::factory()->approved()->create(['landlord_id' => $this->gestor->landlord->id])->id,
            'tenant_id' => $this->creator->tenant->id,
            'status' => 'confirmed',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(40)->toDateString(),
            'total_mount' => '100.00',
            'cancellation_policy_tier' => 'flexible',
        ]);

        $this->cancel($personal, $this->creator, null)->assertOk();

        $notice = Notifications::sole();
        $this->assertSame($this->gestor->id, $notice->receiver_id);
        $this->assertSame($this->creator->id, $notice->sender_id);
        $this->assertSame('Reserva cancelada por el cliente', $notice->title);
        $this->assertSame('El cliente canceló su reserva. Revisa el reembolso correspondiente.', $notice->body);
        $this->assertSame(['reservation_id', 'store_room_id'], array_keys($notice->data));
    }
}
