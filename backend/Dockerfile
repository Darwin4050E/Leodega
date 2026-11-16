FROM php:8.2-cli

RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo pdo_pgsql zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader

COPY . .
RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && php artisan package:discover --ansi \
    && chmod -R 777 storage bootstrap/cache

EXPOSE 8080

CMD ["sh", "-c", "mkdir -p storage/app/public storage/app/private && php artisan storage:link --force && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}"]
