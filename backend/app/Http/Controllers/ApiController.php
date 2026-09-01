<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ApiController extends Controller
{
    //
    protected function indexModel(string $modelClass, array $relations = [])
    {
        $query = $modelClass::query();

        if (! empty($relations)) {
            $query->with($relations);
        }

        $items = $query->get();

        if ($items->isEmpty()) {
            return response()->json(['message' => 'No items found'], 404);
        }

        return response()->json($items, 200);
    }

    protected function showModel(string $modelClass, $id)
    {
        $item = $modelClass::find($id);
        if (! $item) {
            return response()->json(['message' => 'Item not found', 'status' => 404], 404);
        }

        return response()->json($item, 200);
    }

    protected function storeModel(Request $request, string $modelClass, array $rules)
    {
        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
                'status' => 400,
            ], 400);
        }

        $validated = $validator->validated();

        try {
            $item = DB::transaction(function () use ($modelClass, $validated, $request) {
                $mainItem = $modelClass::create($validated);

                $possibleRelations = collect($request->all())
                    ->filter(fn ($v) => is_array($v))
                    ->keys();

                foreach ($possibleRelations as $relationName) {
                    if (method_exists($mainItem, $relationName)) {
                        $relation = $mainItem->$relationName();

                        if (method_exists($relation, 'createMany')) {
                            $relation->createMany($request->get($relationName));
                        }
                    }
                }

                return $mainItem->load($possibleRelations->toArray());
            });

            return response()->json([
                'item' => $item,
                'message' => 'Item created successfully',
                'status' => 201,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error creating item',
                'error' => $e->getMessage(),
                'status' => 500,
            ], 500);
        }
    }

    protected function updateModel(Request $request, string $modelClass, $id, array $rules)
    {
        $item = $modelClass::find($id);
        if (! $item) {
            return response()->json(['message' => 'Not found', 'status' => 404], 404);
        }

        // Agregar "sometimes" automáticamente
        $rules = array_map(function ($r) {
            if (stripos($r, 'sometimes') === false && stripos($r, 'required') === false) {
                return 'sometimes|'.$r;
            }

            return $r;
        }, $rules);

        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error',
                'errors' => $validator->errors(),
                'status' => 400,
            ], 400);
        }

        $validated = $validator->validated();

        try {
            DB::transaction(function () use ($item, $validated, $request) {
                $item->update($validated);

                // Si vienen relaciones, actualizarlas (borra previos y los reemplaza)
                foreach ($request->all() as $key => $value) {
                    if (is_array($value) && method_exists($item, $key)) {
                        $relation = $item->$key();
                        if (method_exists($relation, 'delete') && method_exists($relation, 'createMany')) {
                            $relation->delete();
                            $relation->createMany($value);
                        }
                    }
                }
            });

            return response()->json([
                'data' => $item->fresh(),
                'message' => 'Updated successfully',
                'status' => 200,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error updating item',
                'error' => $e->getMessage(),
                'status' => 500,
            ], 500);
        }
    }

    protected function destroyModel(string $modelClass, $id)
    {
        $item = $modelClass::find($id);
        if (! $item) {
            return response()->json(['message' => 'Item not found', 'status' => 404], 404);
        }
        $item->delete();

        return response()->json(['message' => 'Item deleted successfully', 'status' => 200], 200);
    }
}
