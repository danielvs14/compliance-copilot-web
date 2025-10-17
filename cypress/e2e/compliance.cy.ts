type AuthFixture = {
  user: Record<string, unknown>
  org: Record<string, unknown>
}

type DocumentsFixture = {
  items: Array<Record<string, unknown>>
  pagination: Record<string, unknown>
}

type RequirementsFixture = {
  items: Array<Record<string, unknown>>
  pagination: Record<string, unknown>
}
type RequirementCompleteFixture = Record<string, unknown>
type PermitsFixture = Array<Record<string, unknown>>
type TrainingFixture = Array<Record<string, unknown>>

type Fixtures = {
  auth: AuthFixture
  documents: DocumentsFixture
  requirements: RequirementsFixture
  requirementComplete: RequirementCompleteFixture
  permits: PermitsFixture
  training: TrainingFixture
}

function loadFixtures(): Cypress.Chainable<Fixtures> {
  return cy
    .fixture("auth.json")
    .then((auth) =>
      cy.fixture("documents.json").then((documents) =>
        cy.fixture("requirements.json").then((requirements) =>
          cy.fixture("requirement-complete.json").then((requirementComplete) =>
            cy.fixture("permits.json").then((permits) =>
              cy.fixture("training.json").then((training) => ({
                auth,
                documents,
                requirements,
                requirementComplete,
                permits,
                training,
              })),
            ),
          ),
        ),
      ),
    )
}

describe("Compliance Copilot flows", () => {
  it("renders recent document uploads", () => {
    loadFixtures().then((fixtures) => {
      cy.visit("/documents")
      cy.contains("Recent uploads").should("be.visible")
      const documents = fixtures.documents.items as Array<{ name: string }>;
      documents.forEach((item) => {
        cy.contains(item.name).should("exist")
      })
    })
  })

  it("filters and completes a requirement", () => {
    cy.visit("/requirements")
    cy.get("table tbody tr").should("have.length.greaterThan", 0)
    cy.contains("Arc flash PPE review").should("exist")
    cy.contains("Overdue").click()
    cy.contains("Arc flash PPE review").should("exist")

    cy.get('button[aria-label="Complete"]').first().click()
    cy.contains("Requirement marked complete").should("exist")
  })

  it("shows permit reminders", () => {
    loadFixtures().then((fixtures) => {
      cy.visit("/permits")
      cy.get("table tbody tr").should("have.length.greaterThan", 0)
      const permits = fixtures.permits as Array<{ name: string }>;
      cy.contains(permits[0].name).should("exist")
      cy.get('button[aria-label="Remind"]').first().click()
      cy.get('body').should('have.attr', 'data-last-toast-message', 'Review renewal before expiration')
      cy.get('body').invoke('removeAttr', 'data-last-toast-message')
    })
  })

  it("shows training renewal notices", () => {
    loadFixtures().then((fixtures) => {
      cy.visit("/training")
      cy.get("table tbody tr").should("have.length.greaterThan", 0)
      const training = fixtures.training as Array<{ worker_name: string }>;
      cy.contains(training[0].worker_name).should("exist")
      cy.get('button[aria-label="Remind"]').first().click()
      cy.get('body').should('have.attr', 'data-last-toast-message', 'Renewal reminder added')
      cy.get('body').invoke('removeAttr', 'data-last-toast-message')
    })
  })
})
