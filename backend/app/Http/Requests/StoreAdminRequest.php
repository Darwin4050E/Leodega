<?php

namespace App\Http\Requests;

/**
 * NO es un FormRequest de Laravel a propósito: AdminController pasa estas
 * reglas a ApiController::storeModel(), que hace su propia validación manual
 * y responde 400 con una forma JSON propia si falla. Si esta clase se
 * inyectara como type-hint en el controlador, Laravel la resolvería y
 * validaría automáticamente en el pipeline, devolviendo su 422 estándar en
 * vez del 400 actual — cambiaría el contrato de la API. Se usa solo como
 * bolsa de reglas: (new StoreAdminRequest())->rules().
 */
class StoreAdminRequest
{
    public function rules(): array
    {
        return [
            'user_id' => 'required|exists:user,id',
            'admin_level' => 'required|integer|min:1|max:2',
        ];
    }
}
