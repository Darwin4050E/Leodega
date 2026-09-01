<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CancelationsPolicesController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\FavoritesController;
use App\Http\Controllers\LandlordsController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationsController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PaymentsController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RatingsController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\ReservationsController;
use App\Http\Controllers\SecurityController;
use App\Http\Controllers\SessionController;
use App\Http\Controllers\StoreDisponibilityController;
use App\Http\Controllers\StoreModerationController;
use App\Http\Controllers\StorePhotoController;
use App\Http\Controllers\StorePricesController;
use App\Http\Controllers\StoreRoomsController;
use App\Http\Controllers\TenantsController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink']);
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword']);

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
});
Route::middleware('auth.api:sanctum')->put('/password', [SecurityController::class, 'changePassword']);

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/sessions', [SessionController::class, 'index']);
    Route::delete('/sessions/{tokenId}', [SessionController::class, 'destroy']);
});

// GET queda accesible para cualquier usuario autenticado (no solo admin): lo
// consume la mensajería (Mensajes.tsx / MensajesTendant.tsx) para listar
// contactos, no solo el panel de administración.
Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/user', [UserController::class, 'index']);
    Route::get('/user/{id}', [UserController::class, 'show']);
});
// POST se mantiene público: es el mecanismo real de alta de cuenta que usa
// Decision.tsx tras el flujo de "¿cuál es tu rol?". UserController::store
// bloquea explícitamente que una petición no autenticada se auto-asigne
// role=admin.
Route::post('/user', [UserController::class, 'store']);
Route::middleware(['auth.api:sanctum', 'role:admin'])->group(function () {
    Route::put('/user/{id}', [UserController::class, 'update']);
    Route::delete('/user/{id}', [UserController::class, 'destroy']);
});

Route::get('/landlords', [LandlordsController::class, 'index']);
Route::get('/landlords/{id}', [LandlordsController::class, 'show']);
Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/landlords', [LandlordsController::class, 'store']);
    Route::put('/landlords/{id}', [LandlordsController::class, 'update']);
    Route::delete('/landlords/{id}', [LandlordsController::class, 'destroy']);
});
Route::get('/landlords/{id}/storeRooms', [StoreRoomsController::class, 'getByLandlord']);

Route::middleware(['auth.api:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin', [AdminController::class, 'index']);
    Route::get('/admin/{id}', [AdminController::class, 'show']);
    Route::post('/admin', [AdminController::class, 'store']);
    Route::put('/admin/{id}', [AdminController::class, 'update']);
    Route::delete('/admin/{id}', [AdminController::class, 'destroy']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/tenants', [TenantsController::class, 'index']);
    Route::get('/tenants/{id}', [TenantsController::class, 'show']);
    Route::post('/tenants', [TenantsController::class, 'store']);
    Route::put('/tenants/{id}', [TenantsController::class, 'update']);
    Route::delete('/tenants/{id}', [TenantsController::class, 'destroy']);
});

Route::get('/storeRooms', [StoreRoomsController::class, 'index']);
Route::get('/storeRooms/{id}', [StoreRoomsController::class, 'show']);
Route::get('/store-rooms/{id}/detail', [StoreRoomsController::class, 'detail']);
Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/storeRooms', [StoreRoomsController::class, 'store']);
    Route::put('/storeRooms/{id}', [StoreRoomsController::class, 'update']);
    Route::delete('/storeRooms/{id}', [StoreRoomsController::class, 'destroy']);
});

Route::get('/storePrices', [StorePricesController::class, 'index']);
Route::get('/storePrices/{id}', [StorePricesController::class, 'show']);
Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/storePrices', [StorePricesController::class, 'store']);
    Route::put('/storePrices/{id}', [StorePricesController::class, 'update']);
    Route::delete('/storePrices/{id}', [StorePricesController::class, 'destroy']);
});

// Las fotos no estaban en la tabla original de la Fase 0.5: se detectaron sin
// protección al reescribir este archivo y se cierran aquí mismo por ser el
// mismo tipo de hueco (mutación sin autenticar sobre un recurso de un landlord).
Route::get('/store-rooms/{storeRoom}/photos', [StorePhotoController::class, 'index']);
Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/store-rooms/{storeRoom}/photos', [StorePhotoController::class, 'store']);
    Route::delete('/store-rooms/{storeRoom}/photos/{photo}', [StorePhotoController::class, 'destroy']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/favorites', [FavoritesController::class, 'index']);
    Route::get('/favorites/{id}', [FavoritesController::class, 'show']);
    Route::post('/favorites', [FavoritesController::class, 'store']);
    Route::put('/favorites/{id}', [FavoritesController::class, 'update']);
    Route::delete('/favorites/{id}', [FavoritesController::class, 'destroy']);
});

Route::get('/storeDisponibility', [StoreDisponibilityController::class, 'index']);
Route::get('/storeDisponibility/{id}', [StoreDisponibilityController::class, 'show']);
Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/storeDisponibility', [StoreDisponibilityController::class, 'store']);
    Route::put('/storeDisponibility/{id}', [StoreDisponibilityController::class, 'update']);
    Route::delete('/storeDisponibility/{id}', [StoreDisponibilityController::class, 'destroy']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/reservations', [ReservationsController::class, 'store']);
    Route::get('/landlord/reservations', [ReservationsController::class, 'landlordIndex']);
    Route::patch('/landlord/reservations/{reservation}/status', [ReservationsController::class, 'updateStatus']);
    Route::get('/storeRooms/{id}/reserved-dates', [ReservationsController::class, 'reservedDates']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/payments', [PaymentsController::class, 'index']);
    Route::get('/payments/{id}', [PaymentsController::class, 'show']);
    Route::post('/payments', [PaymentsController::class, 'store']);
    Route::put('/payments/{id}', [PaymentsController::class, 'update']);
    Route::delete('/payments/{id}', [PaymentsController::class, 'destroy']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/ratings', [RatingsController::class, 'index']);
    Route::post('/ratings', [RatingsController::class, 'store']);
});
Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/ratings/{id}', [RatingsController::class, 'show']);
    Route::put('/ratings/{id}', [RatingsController::class, 'update']);
    Route::delete('/ratings/{id}', [RatingsController::class, 'destroy']);
});

Route::get('/cancelations_polices', [CancelationsPolicesController::class, 'index']);
Route::get('/cancelations_polices/{id}', [CancelationsPolicesController::class, 'show']);
Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/cancelations_polices', [CancelationsPolicesController::class, 'store']);
    Route::put('/cancelations_polices/{id}', [CancelationsPolicesController::class, 'update']);
    Route::delete('/cancelations_polices/{id}', [CancelationsPolicesController::class, 'destroy']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::post('/reports', [ReportsController::class, 'store']);
    Route::get('/reports', [ReportsController::class, 'index']);
    Route::get('/reports/{id}', [ReportsController::class, 'show']);
    Route::put('/reports/{id}', [ReportsController::class, 'update']);
});
// El check de rol vivía como `if` manual dentro de updateStatus(); se formaliza
// aquí como middleware, igual que el resto de rutas admin-only (Fase 0.5).
Route::middleware(['auth.api:sanctum', 'role:admin'])->group(function () {
    Route::patch('/reports/{report}/status', [ReportsController::class, 'updateStatus']);
});

// Route::resource('reports', ReportsController::class)->except('create', 'edit');

Route::middleware(['auth.api:sanctum', 'role:admin'])->group(function () {
    Route::get('/store_moderation', [StoreModerationController::class, 'index']);
    Route::get('/store_moderation/{id}', [StoreModerationController::class, 'show']);
    Route::post('/store_moderation', [StoreModerationController::class, 'store']);
    Route::put('/store_moderation/{id}', [StoreModerationController::class, 'update']);
    Route::delete('/store_moderation/{id}', [StoreModerationController::class, 'destroy']);
});

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store']);

    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [MessageController::class, 'store']);
    Route::post('/conversations/{conversation}/read', [MessageController::class, 'markRead']);
});

Route::middleware('auth.api:sanctum')->group(function () {

    Route::get('/notifications', [NotificationsController::class, 'index']);
    Route::post('/notifications', [NotificationsController::class, 'store']);
    Route::post('/notifications/{notification}/read', [NotificationsController::class, 'markAsRead']);
    Route::get('/notifications-unread-count', [NotificationsController::class, 'unreadCount']);
    Route::patch('/notifications/{id}/read', [NotificationsController::class, 'markAsRead']);
});

Route::middleware('auth.api:sanctum')->delete('/account', [UserController::class, 'destroySelf']);

Route::middleware('auth.api:sanctum')->group(function () {
    Route::get('/tenant/reservations', [ReservationsController::class, 'tenantIndex']);
});
