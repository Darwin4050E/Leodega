describe('Login', () => {

  it('TC-F-01: Login exitoso', () => {

    cy.visit('/login')

    cy.get('input[type="email"]').type('admin@leodega.com')
    cy.get('input[type="password"]').type('admin123')

    // El selector por texto es ambiguo: "Iniciar Sesión" también aparece en el
    // <h2> de la página, y cy.contains() matchea ese primero (nunca el botón),
    // por lo que el submit nunca se dispara. Se acota a <button> para desambiguar.
    cy.contains('button', 'Iniciar Sesión').click()

    // ⏳ espera la redirección (NO la request)
    cy.location('pathname', { timeout: 20000 })
      .should('eq', '/admin/bodegas')

    // ✅ opcional: token guardado
    cy.window().then((win) => {
      expect(win.localStorage.getItem('auth_token')).to.exist
    })
  })
})


