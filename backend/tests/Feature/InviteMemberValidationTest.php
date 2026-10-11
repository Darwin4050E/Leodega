<?php

namespace Tests\Feature;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * hue-01 U1a: body validation of POST /organizations/{organization}/invitations
 * (INV-3). Authorization runs first, so every case here is an admin caller.
 */
class InviteMemberValidationTest extends TestCase
{
    use RefreshDatabase;

    private const MISSING = 'Escribe el correo del cliente que quieres invitar.';

    private const MALFORMED = 'Ingresa un correo válido.';

    private Organization $organization;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'tenant']);
        $this->organization = Organization::factory()->withMember($this->admin, OrganizationRole::ADMIN)->create();
    }

    private function invite(array $body)
    {
        return $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/organizations/{$this->organization->id}/invitations", $body);
    }

    private function assertRejectedWith(string $message, array $body): void
    {
        Notification::fake();
        Mail::fake();

        $response = $this->invite($body);

        $response->assertStatus(422)->assertExactJson([
            'message' => $message,
            'errors' => ['email' => [$message]],
        ]);
        $this->assertSame(['message', 'errors'], array_keys($response->json()));
        $this->assertSame(['email'], array_keys($response->json('errors')));
        $this->assertDatabaseCount('organization_invitations', 0);
        $this->assertDatabaseCount('notifications', 0);
        Notification::assertNothingSent();
        Mail::assertNothingSent();
    }

    // INV-S22, INV-S23
    public static function missingEmails(): array
    {
        return [
            'absent' => [[]],
            'null' => [['email' => null]],
            'empty string' => [['email' => '']],
            'whitespace only' => [['email' => '   ']],
        ];
    }

    #[DataProvider('missingEmails')]
    public function test_a_missing_or_blank_email_is_rejected_with_the_missing_message(array $body)
    {
        $this->assertRejectedWith(self::MISSING, $body);
    }

    // INV-S24, INV-S25, INV-S26
    public static function malformedEmails(): array
    {
        return [
            'no at sign' => [['email' => 'not-an-email']],
            'double at sign' => [['email' => 'a@@b.com']],
            'too long' => [['email' => str_repeat('a', 64).'@'.str_repeat('b', 60).'.'.str_repeat('c', 60).'.'.str_repeat('d', 60).'.eeee.com']],
            'array' => [['email' => ['a@b.com']]],
            'number' => [['email' => 12345]],
            'boolean' => [['email' => true]],
        ];
    }

    #[DataProvider('malformedEmails')]
    public function test_a_malformed_too_long_or_non_string_email_is_rejected_with_the_malformed_message(array $body)
    {
        $this->assertRejectedWith(self::MALFORMED, $body);
    }

    public function test_an_email_of_exactly_255_characters_passes_validation()
    {
        $email = str_repeat('a', 64).'@'.str_repeat('b', 60).'.'.str_repeat('c', 60).'.'.str_repeat('d', 60).'.eee.com';
        $this->assertSame(255, strlen($email));

        // Not a registered account: the request gets past validation and is
        // refused later (U1a-2); here it only must not be a format error.
        $response = $this->invite(['email' => $email]);

        $this->assertNotSame(self::MALFORMED, $response->json('errors.email.0'));
        $this->assertNotSame(self::MISSING, $response->json('errors.email.0'));
    }
}
