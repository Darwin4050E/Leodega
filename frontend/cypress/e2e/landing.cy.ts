describe('Landing Page', () => {

  it('TC-F-03: Navegación a todas las bodegas', () => {
    cy.visit('/')

    cy.contains('Mostrar todas las bodegas').click()

    cy.url().should('include', '/storage')
  })

})
