<?php

namespace Tests\Feature;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Tests\TestCase;

/**
 * Guards a failure mode ordinary feature tests cannot catch: a class
 * reference that does not resolve, sitting in a code path nothing exercises.
 *
 * Two real bugs motivated this test, both invisible to a green suite:
 *
 *  - A merge dropped three imports from StoreRoomsController. Two produced a
 *    500 on POST /storeRooms. The third was silent: `catch (ValidationException
 *    $e)` resolved to a class in the controller's own namespace that does not
 *    exist, so the block never matched. PHP raises nothing for an unreachable
 *    catch -- the code reads perfectly and simply never runs.
 *  - CancelationsPolicesController referenced `cancelations_polices` while the
 *    class is `CancelationsPolices`. PSR-4 maps class names to file paths and
 *    that lookup is case-sensitive on Linux, so five routes were broken from
 *    the initial commit. It resolves on case-insensitive filesystems, which is
 *    why it survived local development.
 *
 * Writing per-endpoint tests would have caught each instance. This catches the
 * class of defect instead, including in code no test reaches.
 */
class ClassReferenceResolutionTest extends TestCase
{
    /** @test */
    public function every_class_reference_under_app_resolves()
    {
        $root = dirname(__DIR__, 2).'/app';
        $unresolved = [];

        foreach ($this->phpFilesIn($root) as $file) {
            $source = file_get_contents($file);
            [$namespace, $aliases] = $this->parseHeader($source);

            foreach ($this->classReferences($source) as [$symbol, $line]) {
                $fqn = $this->resolve($symbol, $namespace, $aliases);

                if ($this->typeExists($fqn)) {
                    continue;
                }

                // An unimported bare name falls back to the global namespace
                // (e.g. `Exception`, `RecursiveIteratorIterator`).
                if (! str_contains($symbol, '\\') && ! isset($aliases[$symbol]) && $this->typeExists($symbol)) {
                    continue;
                }

                $relative = str_replace(dirname($root).'/', '', $file);
                $unresolved[] = "{$relative}:{$line}  {$symbol}  ->  {$fqn}";
            }
        }

        $this->assertSame([], $unresolved, sprintf(
            "Class references that do not resolve (a missing `use`, or a name whose ".
            "case does not match the file):\n\n%s\n",
            implode("\n", $unresolved)
        ));
    }

    /** @return iterable<string> */
    private function phpFilesIn(string $dir): iterable
    {
        $files = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir)) as $entry) {
            if ($entry->isFile() && $entry->getExtension() === 'php') {
                $files[] = $entry->getPathname();
            }
        }
        sort($files);

        return $files;
    }

    /**
     * @return array{0: string, 1: array<string, string>} namespace and alias map
     */
    private function parseHeader(string $source): array
    {
        $tokens = token_get_all($source);
        $count = count($tokens);
        $namespace = '';
        $aliases = [];

        for ($i = 0; $i < $count; $i++) {
            if (! is_array($tokens[$i])) {
                continue;
            }

            if ($tokens[$i][0] === T_NAMESPACE) {
                $namespace = trim($this->readUntilTerminator($tokens, $i + 1, $count), '\\');

                continue;
            }

            if ($tokens[$i][0] !== T_USE || ! $this->isTopLevelUse($tokens, $i)) {
                continue;
            }

            $clause = $this->readUntilTerminator($tokens, $i + 1, $count, keepCommas: true);

            // `use function ...` / `use const ...` import symbols, not types.
            if (str_starts_with($clause, 'function') || str_starts_with($clause, 'const')) {
                continue;
            }

            foreach (explode(',', $clause) as $one) {
                if (($one = trim($one)) === '') {
                    continue;
                }
                if (stripos($one, ' as ') !== false) {
                    [$fqn, $alias] = preg_split('/\s+as\s+/i', $one);
                } else {
                    $fqn = $one;
                    $parts = explode('\\', $one);
                    $alias = end($parts);
                }
                $aliases[trim($alias)] = trim($fqn, '\\');
            }
        }

        return [$namespace, $aliases];
    }

    /**
     * A `use` that is not a closure's `use (...)` nor a trait import inside a
     * class body. Both of those follow `)` or `{`.
     */
    private function isTopLevelUse(array $tokens, int $index): bool
    {
        for ($i = $index - 1; $i >= 0; $i--) {
            if (is_array($tokens[$i]) && $tokens[$i][0] === T_WHITESPACE) {
                continue;
            }

            return ! in_array($tokens[$i], [')', '{'], true);
        }

        return true;
    }

    private function readUntilTerminator(array $tokens, int $from, int $count, bool $keepCommas = false): string
    {
        $buffer = '';
        for ($i = $from; $i < $count; $i++) {
            if ($tokens[$i] === ';' || $tokens[$i] === '{') {
                break;
            }
            if ($keepCommas && $tokens[$i] === ',') {
                $buffer .= ',';
            }
            if (is_array($tokens[$i]) && $tokens[$i][0] !== T_WHITESPACE) {
                $buffer .= $tokens[$i][1];
            }
        }

        return $buffer;
    }

    /**
     * Type references in the three positions that actually broke: `new X`,
     * `catch (X`, `instanceof X`, and `X::`.
     *
     * @return list<array{0: string, 1: int}>
     */
    private function classReferences(string $source): array
    {
        $tokens = token_get_all($source);
        $count = count($tokens);
        $names = [T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED];
        $refs = [];

        for ($i = 0; $i < $count; $i++) {
            if (! is_array($tokens[$i])) {
                continue;
            }

            if (in_array($tokens[$i][0], [T_NEW, T_CATCH, T_INSTANCEOF], true)) {
                for ($j = $i + 1; $j < $count; $j++) {
                    if (is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) {
                        continue;
                    }
                    if ($tokens[$j] === '(') {
                        continue;
                    }
                    if (is_array($tokens[$j]) && in_array($tokens[$j][0], $names, true)) {
                        $refs[] = [$tokens[$j][1], $tokens[$j][2]];
                    }
                    break;
                }

                continue;
            }

            if ($tokens[$i][0] === T_DOUBLE_COLON) {
                for ($j = $i - 1; $j >= 0; $j--) {
                    if (is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) {
                        continue;
                    }
                    if (is_array($tokens[$j]) && in_array($tokens[$j][0], $names, true)) {
                        $refs[] = [$tokens[$j][1], $tokens[$j][2]];
                    }
                    break;
                }
            }
        }

        return array_values(array_filter($refs, fn ($ref) => ! in_array(
            strtolower($ref[0]),
            ['self', 'static', 'parent', 'class', 'true', 'false', 'null'],
            true
        )));
    }

    /** @param array<string, string> $aliases */
    private function resolve(string $symbol, string $namespace, array $aliases): string
    {
        if (str_starts_with($symbol, '\\')) {
            return ltrim($symbol, '\\');
        }

        if (isset($aliases[$symbol])) {
            return $aliases[$symbol];
        }

        if (str_contains($symbol, '\\')) {
            $head = explode('\\', $symbol)[0];

            return isset($aliases[$head])
                ? $aliases[$head].substr($symbol, strlen($head))
                : $namespace.'\\'.$symbol;
        }

        return $namespace ? $namespace.'\\'.$symbol : $symbol;
    }

    private function typeExists(string $fqn): bool
    {
        return class_exists($fqn) || interface_exists($fqn) || trait_exists($fqn) || enum_exists($fqn);
    }
}
