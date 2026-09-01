describe('TC-F-04: Creación de Bodega', () => {

    beforeEach(() => {
        cy.visit('/')

        cy.window().then(win => {
            win.localStorage.setItem(
                'auth_user',
                JSON.stringify({ landlord: { id: 1 } })
            )
            win.localStorage.setItem('auth_token', 'fake-token')
            // El paso 4 exige una dirección/ciudad resuelta (por sugerencia o
            // clic en el mapa) antes de habilitar "Siguiente"; se precarga
            // aquí para no depender de la API real de Nominatim en el test.
            win.localStorage.setItem('optionData', JSON.stringify({
                location: {
                    direction: 'Av. Principal 123',
                    city: 'Guayaquil',
                    geographical_zone: 'Guayas',
                    position: [-2.170998, -79.922359],
                }
            }))
        })

        cy.intercept('POST', '**/storeRooms', {
            statusCode: 200,
            body: { id: 99, message: 'Solicitud creada correctamente' }
        }).as('storeRooms')

        cy.intercept(
            'POST',
            '**/store-rooms/**/photos',
            {
                statusCode: 200,
                body: { message: 'Fotos subidas correctamente' }
            }
        ).as('uploadPhotos')
    })



    it('Crea una bodega exitosamente', () => {

        // Paso 1
        cy.visit('/preguntainicio1')
        cy.contains('Bodega Indep.').click()
        cy.contains('Siguiente').click()

        // Paso 2
        cy.contains('Una bodega Completa').click()
        cy.contains('Siguiente').click()

        // Paso 3 (fotos)
        const imagePath = 'bodega.jpg'
        for (let i = 0; i < 5; i++) {
            cy.get('input[type="file"]').selectFile(`cypress/fixtures/${imagePath}`, {
                force: true
            })
        }
        cy.contains('Siguiente').click()

        // Paso 4 (mapa – ubicación precargada en localStorage vía beforeEach)
        cy.contains('Siguiente').click()

        // Paso 5 (título)
        cy.get('#titulo').type('Bodega Cypress')
        cy.get('#descripcion').type('Bodega creada desde Cypress')
        cy.contains('Siguiente').click()

        // Paso 6 (precio)
        cy.get('input[type="number"]').first().type('100')
        cy.get('input[type="number"]').last().type('10')
        cy.contains('Siguiente').click()

        // Paso 7 (seguridad + política)
        // Página 7
        cy.location('pathname').should('include', 'PreguntaInicio7')

        cy.get('select').should('be.visible').select('Flexible')
        cy.contains('Enviar Solicitud').click()

        cy.wait('@storeRooms')
        cy.wait('@uploadPhotos')

        cy.contains('Tu solicitud ha sido enviada').should('be.visible')


        cy.contains('Aceptar').click()

        // Redirección
        cy.location('pathname').should('eq', '/arrendador/bodegas')

    })

    describe('TC-F-05: Validación de Campos', () => {

        it('No permite avanzar sin título y descripción', () => {
            cy.visit('/preguntainicio5')

            cy.contains('Siguiente').should('be.disabled')

            cy.get('#titulo').type('Solo título')
            cy.contains('Siguiente').should('be.disabled')

            cy.get('#descripcion').type('Descripción válida')
            cy.contains('Siguiente').should('not.be.disabled')
        })

        it('No permite enviar sin política', () => {
            cy.visit('/preguntainicio7')

            cy.contains('Enviar Solicitud').should('be.disabled')
        })

        it('No permite avanzar en el paso 4 sin dirección y ciudad', () => {
            cy.window().then(win => win.localStorage.removeItem('optionData'))
            cy.visit('/preguntainicio4')

            cy.contains('Siguiente').should('be.disabled')

            cy.get('#city').type('Guayaquil')
            cy.contains('Siguiente').should('be.disabled')
        })
    })

})
