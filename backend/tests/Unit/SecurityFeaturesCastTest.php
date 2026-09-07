<?php

namespace Tests\Unit;

use App\Casts\SecurityFeatures;
use App\Models\StoreRooms;
use PHPUnit\Framework\TestCase;

/**
 * Pure unit tests for the read-normalising `security` cast — no DB.
 */
class SecurityFeaturesCastTest extends TestCase
{
    private function get(?string $stored): array
    {
        $cast = new SecurityFeatures;

        return $cast->get(new StoreRooms, 'security', $stored, []);
    }

    public function test_valid_full_json_is_mapped_to_four_booleans(): void
    {
        $stored = json_encode([
            'camara' => true,
            'ruido' => false,
            'control' => true,
            'acceso' => true,
        ]);

        $this->assertSame([
            'camara' => true,
            'ruido' => false,
            'control' => true,
            'acceso' => true,
        ], $this->get($stored));
    }

    public function test_legacy_objetos_is_discarded_not_mapped_to_acceso(): void
    {
        $stored = json_encode([
            'camara' => true,
            'ruido' => true,
            'control' => true,
            'objetos' => true,
        ]);

        $result = $this->get($stored);

        $this->assertFalse($result['acceso']);
        $this->assertArrayNotHasKey('objetos', $result);
    }

    public function test_malformed_value_yields_four_falses_without_throwing(): void
    {
        $this->assertSame([
            'camara' => false,
            'ruido' => false,
            'control' => false,
            'acceso' => false,
        ], $this->get('not json at all'));
    }

    public function test_non_json_plain_string_yields_four_falses(): void
    {
        $this->assertSame([
            'camara' => false,
            'ruido' => false,
            'control' => false,
            'acceso' => false,
        ], $this->get('Cámaras 24/7'));
    }

    public function test_empty_string_yields_four_falses(): void
    {
        $this->assertSame([
            'camara' => false,
            'ruido' => false,
            'control' => false,
            'acceso' => false,
        ], $this->get(''));
    }

    public function test_null_value_yields_four_falses(): void
    {
        $this->assertSame([
            'camara' => false,
            'ruido' => false,
            'control' => false,
            'acceso' => false,
        ], $this->get(null));
    }

    public function test_partial_json_defaults_missing_keys_to_false(): void
    {
        $stored = json_encode(['camara' => true]);

        $this->assertSame([
            'camara' => true,
            'ruido' => false,
            'control' => false,
            'acceso' => false,
        ], $this->get($stored));
    }
}
