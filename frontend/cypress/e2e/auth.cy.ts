describe('Login - Frontend', () => {

  it('TC-F-02: Validación de email inválido', () => {
  cy.visit('/login')

  cy.get('input[type="email"]')
    .type('correo-invalido')
    .blur()

  cy.get('input[type="email"]')
    .then((input) => {
      expect((input[0] as HTMLInputElement).validationMessage).to.not.be.empty
    })
})

})
