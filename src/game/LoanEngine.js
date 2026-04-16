// LoanEngine.js — bank loan system

const LOAN_TIERS = [
  { amount: 2000,  rate: 0.003  },
  { amount: 5000,  rate: 0.0025 },
  { amount: 10000, rate: 0.002  },
  { amount: 20000, rate: 0.0018 },
  { amount: 50000, rate: 0.0015 },
]

let _nextLoanId = 1

function takeLoan(state, tierIndex) {
  const tier = LOAN_TIERS[tierIndex]
  if (!tier) return { success: false, message: 'Niveau de prêt invalide' }

  if (!Array.isArray(state.loans)) state.loans = []

  const hasActive = state.loans.some(l => !l.paid)
  if (hasActive) return { success: false, message: 'Un prêt est déjà en cours' }

  const loan = {
    id:        _nextLoanId++,
    tierIndex,
    principal: tier.amount,
    rate:      tier.rate,
    remaining: tier.amount,
    paid:      false,
    dayTaken:  state.day,
  }
  state.loans.push(loan)
  state.money += tier.amount
  return { success: true, loan }
}

function repayLoan(state, loanId) {
  if (!Array.isArray(state.loans)) return { success: false, message: 'Aucun prêt' }
  const loan = state.loans.find(l => l.id === loanId && !l.paid)
  if (!loan) return { success: false, message: 'Prêt introuvable' }

  const payment = Math.min(loan.remaining, state.money)
  if (payment <= 0) return { success: false, message: 'Fonds insuffisants' }

  state.money     -= payment
  loan.remaining  -= payment
  if (loan.remaining <= 0) {
    loan.remaining = 0
    loan.paid      = true
  }
  return { success: true, paid: loan.paid, payment }
}

function processLoans(state) {
  if (!Array.isArray(state.loans)) return
  for (const loan of state.loans) {
    if (loan.paid) continue

    // Daily interest
    const interest   = Math.ceil(loan.remaining * loan.rate)
    loan.remaining  += interest

    // Minimum daily repayment (1% of principal)
    const minPayment = Math.max(1, Math.ceil(loan.principal * 0.01))
    const payment    = Math.min(minPayment, loan.remaining, Math.max(0, state.money))
    state.money     -= payment
    loan.remaining  -= payment

    if (loan.remaining <= 0) {
      loan.remaining = 0
      loan.paid      = true
    }

    // Reputation penalty if debt exceeds available money
    if (loan.remaining > state.money) {
      state.reputation = Math.max(0, (state.reputation ?? 0) - 0.5)
    }
  }
}

function getTotalDebt(state) {
  if (!Array.isArray(state.loans)) return 0
  return state.loans.filter(l => !l.paid).reduce((s, l) => s + l.remaining, 0)
}

export { LOAN_TIERS, takeLoan, repayLoan, processLoans, getTotalDebt }
