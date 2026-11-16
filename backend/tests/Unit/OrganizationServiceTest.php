<?php

namespace Tests\Unit;

use App\Models\Organization;
use App\Models\User;
use App\Services\OrganizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Tests\TestCase;

class OrganizationServiceTest extends TestCase
{
    use RefreshDatabase;

    private function creator(): User
    {
        return User::factory()->create(['role' => 'tenant']);
    }

    private function validData(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Importadora Andina S.A.',
            'ruc' => '1790012345001',
            'email' => 'contacto@andina.ec',
        ], $overrides);
    }

    private function fakeLogo(): UploadedFile
    {
        return UploadedFile::fake()->create('logo.png', 100, 'image/png');
    }

    /**
     * Makes the next insert into the membership pivot blow up after the SQL
     * ran, i.e. inside the service's transaction.
     */
    private function failOnPivotInsert(): void
    {
        DB::listen(function ($query) {
            if (str_contains($query->sql, 'insert into "organization_user"')) {
                throw new RuntimeException('pivot insert failed');
            }
        });
    }

    public function test_create_persists_the_organization_and_the_creator_as_admin()
    {
        $creator = $this->creator();

        $organization = (new OrganizationService)->create($creator, $this->validData());

        $this->assertSame($creator->id, $organization->created_by);
        $this->assertSame('admin', $organization->pivot->role);
        $this->assertDatabaseHas('organization_user', [
            'organization_id' => $organization->id,
            'user_id' => $creator->id,
            'role' => 'admin',
        ]);
    }

    public function test_create_forces_created_by_and_logo_path_over_the_caller_data()
    {
        $creator = $this->creator();
        $other = $this->creator();

        $organization = (new OrganizationService)->create(
            $creator,
            $this->validData(['created_by' => $other->id, 'logo_path' => 'evil/x.png'])
        );

        $this->assertSame($creator->id, $organization->fresh()->created_by);
        $this->assertNull($organization->fresh()->logo_path);
    }

    public function test_a_failing_pivot_insert_rolls_back_the_organization()
    {
        $this->failOnPivotInsert();

        try {
            (new OrganizationService)->create($this->creator(), $this->validData());
            $this->fail('Expected the forced pivot failure to propagate.');
        } catch (RuntimeException $e) {
            $this->assertSame('pivot insert failed', $e->getMessage());
        }

        $this->assertSame(0, Organization::count());
    }

    public function test_a_pre_existing_ruc_raises_a_validation_exception_on_ruc()
    {
        Organization::factory()->create(['ruc' => '1790012345001']);

        try {
            (new OrganizationService)->create($this->creator(), $this->validData());
            $this->fail('Expected a ValidationException.');
        } catch (ValidationException $e) {
            $this->assertSame(
                ['ruc' => ['Ya existe una organización registrada con este RUC']],
                $e->errors()
            );
        }

        $this->assertSame(1, Organization::count());
    }

    public function test_create_with_a_logo_stores_it_on_the_public_disk_and_records_the_path()
    {
        Storage::fake('public');

        $organization = (new OrganizationService)->create($this->creator(), $this->validData(), $this->fakeLogo());

        $this->assertStringStartsWith('organization_logos/', $organization->logo_path);
        Storage::disk('public')->assertExists($organization->logo_path);
        $this->assertSame($organization->logo_path, $organization->fresh()->logo_path);
    }

    public function test_a_failing_pivot_insert_with_a_logo_leaves_no_row_and_no_file()
    {
        Storage::fake('public');
        $this->failOnPivotInsert();

        try {
            (new OrganizationService)->create($this->creator(), $this->validData(), $this->fakeLogo());
            $this->fail('Expected the forced pivot failure to propagate.');
        } catch (RuntimeException) {
            // expected
        }

        $this->assertSame(0, Organization::count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_a_pre_existing_ruc_with_a_logo_raises_a_validation_exception_and_deletes_the_file()
    {
        Storage::fake('public');
        Organization::factory()->create(['ruc' => '1790012345001']);

        $this->expectException(ValidationException::class);

        try {
            (new OrganizationService)->create($this->creator(), $this->validData(), $this->fakeLogo());
        } finally {
            $this->assertSame([], Storage::disk('public')->allFiles());
            $this->assertSame(1, Organization::count());
        }
    }

    public function test_without_a_logo_the_disk_is_never_touched_on_success_or_failure()
    {
        Storage::shouldReceive('disk')->never();

        (new OrganizationService)->create($this->creator(), $this->validData());

        $this->failOnPivotInsert();
        try {
            (new OrganizationService)->create($this->creator(), $this->validData(['ruc' => '1790012346001']));
            $this->fail('Expected the forced pivot failure to propagate.');
        } catch (RuntimeException) {
            // expected
        }

        $this->assertSame(1, Organization::count());
    }
}
