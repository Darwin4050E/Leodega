describe('Navegación', () => {

  it('TC-F-03: Navegación a Registro', () => {
    cy.visit('/login')

    cy.contains('Regístrate').click()

    cy.location('pathname')
      .should('eq', '/register')

    cy.contains('Registrarse').should('exist')
  })

})
