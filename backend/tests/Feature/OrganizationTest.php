<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * HUE-04 U1: POST/GET /api/organizations (tenant only), with an optional
 * logo uploaded as multipart. The suite runs without the GD extension, so
 * logos are always UploadedFile::fake()->create(...), never ->image().
 */
class OrganizationTest extends TestCase
{
    use RefreshDatabase;

    private const LOGO_MAX_MESSAGE = 'El logo no puede superar 2 MB';

    private const LOGO_MIMES_MESSAGE = 'El logo debe ser una imagen PNG o JPG';

    private const LOGO_FILE_MESSAGE = 'No se pudo cargar el logo. Intenta con otra imagen';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    private function tenant(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Importadora Andina S.A.',
            'ruc' => '1790012345001',
            'email' => 'contacto@andina.ec',
        ], $overrides);
    }

    /**
     * Multipart on purpose: `Accept: application/json` makes a FormRequest
     * failure a 422 JSON body instead of a redirect.
     */
    private function postOrganization(?User $user, array $data): \Illuminate\Testing\TestResponse
    {
        $request = $user ? $this->actingAs($user, 'sanctum') : $this;

        return $request->post('/api/organizations', $data, ['Accept' => 'application/json']);
    }

    private function assertNothingWritten(): void
    {
        $this->assertSame(0, Organization::count());
        $this->assertDatabaseCount('organization_user', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    // ---------------------------------------------------------------
    // Access (OM-S1..S3)
    // ---------------------------------------------------------------

    public function test_unauthenticated_request_gets_401_and_writes_nothing()
    {
        $response = $this->postOrganization(null, $this->validPayload());

        $response->assertStatus(401);
        $response->assertJsonStructure(['message']);
        $this->assertNothingWritten();
    }

    #[DataProvider('nonTenantRoleProvider')]
    public function test_non_tenant_roles_get_403_and_write_nothing(string $role)
    {
        $user = User::factory()->create(['role' => $role]);

        $response = $this->postOrganization($user, $this->validPayload());

        $response->assertStatus(403);
        $response->assertExactJson(['message' => 'No autorizado']);
        $this->assertNothingWritten();
    }

    public static function nonTenantRoleProvider(): array
    {
        return [
            'landlord' => ['landlord'],
            'admin' => ['admin'],
        ];
    }

    // ---------------------------------------------------------------
    // Creation (OM-S1, S11, S14..S18)
    // ---------------------------------------------------------------

    public function test_tenant_creates_an_organization_and_becomes_its_admin()
    {
        $tenant = $this->tenant();

        $response = $this->postOrganization($tenant, $this->validPayload());

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Organización creada correctamente');
        $response->assertJsonPath('organization.name', 'Importadora Andina S.A.');
        $response->assertJsonPath('organization.ruc', '1790012345001');
        $response->assertJsonPath('organization.email', 'contacto@andina.ec');
        $response->assertJsonPath('organization.status', 'active');
        $response->assertJsonPath('organization.logo', null);
        $response->assertJsonPath('organization.role', 'admin');
        $this->assertEqualsCanonicalizing(
            ['id', 'name', 'ruc', 'email', 'status', 'logo', 'role'],
            array_keys($response->json('organization'))
        );

        $organization = Organization::firstOrFail();
        $this->assertSame($organization->id, $response->json('organization.id'));
        $this->assertSame('active', $organization->status);
        $this->assertSame($tenant->id, $organization->created_by);
        $this->assertDatabaseHas('organization_user', [
            'organization_id' => $organization->id,
            'user_id' => $tenant->id,
            'role' => 'admin',
        ]);
        $this->assertNotNull($organization->users()->first()->pivot->joined_at);
    }

    public function test_name_of_exactly_255_characters_is_accepted()
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload(['name' => str_repeat('a', 255)]));

        $response->assertStatus(201);
    }

    public function test_a_tenant_can_create_a_second_organization_with_a_different_ruc()
    {
        $tenant = $this->tenant();

        $this->postOrganization($tenant, $this->validPayload())->assertStatus(201);
        $this->postOrganization($tenant, $this->validPayload(['ruc' => '1790012346001']))->assertStatus(201);

        $this->assertSame(2, Organization::count());
        $this->assertSame(2, $tenant->organizations()->count());
    }

    public function test_email_is_not_unique_across_organizations()
    {
        $this->postOrganization($this->tenant(), $this->validPayload())->assertStatus(201);

        $response = $this->postOrganization($this->tenant(), $this->validPayload(['ruc' => '1790012346001']));

        $response->assertStatus(201);
        $this->assertSame(2, Organization::where('email', 'contacto@andina.ec')->count());
    }

    public function test_status_created_by_and_role_in_the_body_are_ignored()
    {
        $tenant = $this->tenant();
        $other = $this->tenant();

        $response = $this->postOrganization($tenant, $this->validPayload([
            'status' => 'suspended',
            'created_by' => $other->id,
            'role' => 'member',
        ]));

        $response->assertStatus(201);
        $response->assertJsonPath('organization.status', 'active');
        $response->assertJsonPath('organization.role', 'admin');
        $organization = Organization::firstOrFail();
        $this->assertSame('active', $organization->status);
        $this->assertSame($tenant->id, $organization->created_by);
        $this->assertSame('admin', $organization->users()->first()->pivot->role);
    }

    // ---------------------------------------------------------------
    // Validation (OM-S4..S13, S19)
    // ---------------------------------------------------------------

    #[DataProvider('invalidPayloadProvider')]
    public function test_invalid_payload_returns_422_with_the_field_message_and_writes_nothing(
        array $overrides,
        array $remove,
        string $field,
        string $message
    ) {
        $payload = array_diff_key($this->validPayload($overrides), array_flip($remove));

        $response = $this->postOrganization($this->tenant(), $payload);

        $response->assertStatus(422);
        $response->assertJsonPath("errors.{$field}.0", $message);
        $response->assertJsonMissingPath('status');
        $this->assertNothingWritten();
    }

    public static function invalidPayloadProvider(): array
    {
        // 256 characters in total. The email rule rejects it too (RFC limit is
        // 254), so this proves the max message is the one reported.
        $longEmail = str_repeat('a', 64).'@'.str_repeat('b', 63).'.'.str_repeat('c', 63).'.'.str_repeat('d', 59).'.com';

        return [
            'name missing' => [[], ['name'], 'name', 'La razón social es obligatoria'],
            'name empty' => [['name' => ''], [], 'name', 'La razón social es obligatoria'],
            'name array' => [['name' => ['x']], [], 'name', 'La razón social no es válida'],
            'name 256 chars' => [['name' => str_repeat('a', 256)], [], 'name', 'La razón social no puede superar 255 caracteres'],
            'ruc missing' => [[], ['ruc'], 'ruc', 'El RUC es obligatorio'],
            'ruc integer' => [['ruc' => 1790012345001], [], 'ruc', 'El RUC debe tener 13 dígitos'],
            'ruc array' => [['ruc' => ['1790012345001']], [], 'ruc', 'El RUC debe tener 13 dígitos'],
            'ruc 12 digits' => [['ruc' => '179001234501'], [], 'ruc', 'El RUC debe tener 13 dígitos'],
            'ruc 14 digits' => [['ruc' => '17900123450011'], [], 'ruc', 'El RUC debe tener 13 dígitos'],
            'ruc letters' => [['ruc' => '17900123450AB'], [], 'ruc', 'El RUC debe tener 13 dígitos'],
            'ruc spaces' => [['ruc' => '179 001 234 5001'], [], 'ruc', 'El RUC debe tener 13 dígitos'],
            'ruc not ending in 001' => [['ruc' => '1790012345002'], [], 'ruc', 'El RUC debe terminar en 001'],
            'email missing' => [[], ['email'], 'email', 'Ingresa un correo válido para la organización'],
            'email without domain' => [['email' => 'abc'], [], 'email', 'Ingresa un correo válido para la organización'],
            'email without tld' => [['email' => 'a@b'], [], 'email', 'Ingresa un correo válido para la organización'],
            'email 256 chars' => [['email' => $longEmail], [], 'email', 'El correo no puede superar 255 caracteres'],
        ];
    }

    public function test_duplicate_ruc_returns_422_with_the_duplicate_message_and_no_new_rows()
    {
        $this->postOrganization($this->tenant(), $this->validPayload())->assertStatus(201);

        $response = $this->postOrganization($this->tenant(), $this->validPayload(['name' => 'Otra empresa']));

        $response->assertStatus(422);
        $response->assertJsonPath('errors.ruc.0', 'Ya existe una organización registrada con este RUC');
        $response->assertJsonMissingPath('status');
        $this->assertSame(1, Organization::count());
        $this->assertDatabaseCount('organization_user', 1);
    }

    // ---------------------------------------------------------------
    // Logo (OM-S38..S51)
    // ---------------------------------------------------------------

    public function test_without_a_logo_the_organization_has_no_logo_and_nothing_is_stored()
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload());

        $response->assertStatus(201);
        $response->assertJsonPath('organization.logo', null);
        $this->assertNull(Organization::firstOrFail()->logo_path);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_an_empty_logo_field_is_treated_as_no_logo()
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload(['logo' => '']));

        $response->assertStatus(201);
        $response->assertJsonPath('organization.logo', null);
        $this->assertNull(Organization::firstOrFail()->logo_path);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    #[DataProvider('validLogoProvider')]
    public function test_a_valid_logo_is_stored_and_returned_as_a_usable_url(string $name, string $mime)
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload([
            'logo' => UploadedFile::fake()->create($name, 100, $mime),
        ]));

        $response->assertStatus(201);
        $organization = Organization::firstOrFail();
        $this->assertNotNull($organization->logo_path);
        $this->assertStringStartsWith('organization_logos/', $organization->logo_path);
        Storage::disk('public')->assertExists($organization->logo_path);
        $response->assertJsonPath('organization.logo', asset('storage/'.$organization->logo_path));
        $response->assertJsonMissingPath('organization.logo_path');
    }

    public static function validLogoProvider(): array
    {
        return [
            'png' => ['logo.png', 'image/png'],
            'jpg' => ['logo.jpg', 'image/jpeg'],
        ];
    }

    public function test_a_logo_path_in_the_body_is_ignored()
    {
        $this->postOrganization($this->tenant(), $this->validPayload(['logo_path' => 'evil/x.png']))
            ->assertStatus(201);

        $this->assertNull(Organization::firstOrFail()->logo_path);
    }

    public function test_a_logo_path_in_the_body_does_not_replace_the_stored_path()
    {
        $this->postOrganization($this->tenant(), $this->validPayload([
            'logo_path' => 'evil/x.png',
            'logo' => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
        ]))->assertStatus(201);

        $this->assertStringStartsWith('organization_logos/', Organization::firstOrFail()->logo_path);
    }

    public function test_a_logo_of_exactly_2048_kb_is_accepted_and_one_kb_more_is_rejected()
    {
        $tenant = $this->tenant();

        $this->postOrganization($tenant, $this->validPayload([
            'logo' => UploadedFile::fake()->create('logo.png', 2048, 'image/png'),
        ]))->assertStatus(201);

        $response = $this->postOrganization($tenant, $this->validPayload([
            'ruc' => '1790012346001',
            'logo' => UploadedFile::fake()->create('logo.png', 2049, 'image/png'),
        ]));

        $response->assertStatus(422);
        $response->assertJsonPath('errors.logo.0', self::LOGO_MAX_MESSAGE);
        $this->assertSame(1, Organization::count());
        $this->assertCount(1, Storage::disk('public')->allFiles());
    }

    #[DataProvider('rejectedLogoProvider')]
    public function test_a_logo_that_is_not_png_or_jpg_is_rejected(string $name, int $kb, string $mime)
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload([
            'logo' => UploadedFile::fake()->create($name, $kb, $mime),
        ]));

        $response->assertStatus(422);
        $response->assertJsonPath('errors.logo.0', self::LOGO_MIMES_MESSAGE);
        $this->assertNothingWritten();
    }

    public static function rejectedLogoProvider(): array
    {
        return [
            'gif' => ['logo.gif', 10, 'image/gif'],
            'webp' => ['logo.webp', 10, 'image/webp'],
            'svg' => ['logo.svg', 10, 'image/svg+xml'],
            'pdf' => ['logo.pdf', 10, 'application/pdf'],
            'png name with a text content type' => ['logo.png', 10, 'text/plain'],
        ];
    }

    public function test_a_logo_sent_as_a_plain_string_is_a_422_not_a_500()
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload(['logo' => 'not-a-file']));

        $response->assertStatus(422);
        $response->assertJsonPath('errors.logo.0', self::LOGO_FILE_MESSAGE);
        $this->assertNothingWritten();
    }

    public function test_a_logo_sent_as_an_array_is_a_422_not_a_500()
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload(['logo' => ['x', 'y']]));

        $response->assertStatus(422);
        $response->assertJsonPath('errors.logo.0', self::LOGO_FILE_MESSAGE);
        $this->assertNothingWritten();
    }

    public function test_an_invalid_name_and_an_invalid_logo_report_both_errors()
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload([
            'name' => '',
            'logo' => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf'),
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name', 'logo']);
        $response->assertJsonMissingPath('status');
        $this->assertNothingWritten();
    }

    #[DataProvider('nonTenantRoleProvider')]
    public function test_non_tenants_with_a_logo_get_403_and_write_nothing(string $role)
    {
        $user = User::factory()->create(['role' => $role]);

        $this->postOrganization($user, $this->validPayload([
            'logo' => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
        ]))->assertStatus(403);

        $this->assertNothingWritten();
    }

    public function test_unauthenticated_request_with_a_logo_gets_401_and_writes_nothing()
    {
        $this->postOrganization(null, $this->validPayload([
            'logo' => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
        ]))->assertStatus(401);

        $this->assertNothingWritten();
    }

    // ---------------------------------------------------------------
    // No orphan files (OM-S50, S51)
    // ---------------------------------------------------------------

    public function test_a_duplicate_ruc_with_a_valid_logo_writes_no_file()
    {
        $this->postOrganization($this->tenant(), $this->validPayload())->assertStatus(201);

        $response = $this->postOrganization($this->tenant(), $this->validPayload([
            'logo' => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['ruc']);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_a_duplicate_ruc_leaves_the_first_organizations_logo_untouched()
    {
        $this->postOrganization($this->tenant(), $this->validPayload([
            'logo' => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
        ]))->assertStatus(201);
        $firstPath = Organization::firstOrFail()->logo_path;

        $this->postOrganization($this->tenant(), $this->validPayload([
            'logo' => UploadedFile::fake()->create('logo.jpg', 100, 'image/jpeg'),
        ]))->assertStatus(422);

        Storage::disk('public')->assertExists($firstPath);
        $this->assertSame([$firstPath], Storage::disk('public')->allFiles());
        $this->assertSame($firstPath, Organization::firstOrFail()->logo_path);
    }

    public function test_an_invalid_email_with_a_valid_logo_writes_no_file()
    {
        $response = $this->postOrganization($this->tenant(), $this->validPayload([
            'email' => 'abc',
            'logo' => UploadedFile::fake()->create('logo.png', 100, 'image/png'),
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
        $this->assertNothingWritten();
    }

    // ---------------------------------------------------------------
    // Scope (OM-S37)
    // ---------------------------------------------------------------

    public function test_no_route_updates_or_deletes_an_organization_or_its_logo()
    {
        $organizationRoutes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/organizations'));

        $this->assertNotEmpty($organizationRoutes);
        foreach ($organizationRoutes as $route) {
            $this->assertEmpty(
                array_intersect($route->methods(), ['PUT', 'PATCH', 'DELETE']),
                "Unexpected write verb on {$route->uri()}"
            );
            $this->assertStringNotContainsString('logo', $route->uri());
        }
    }
}
