import React from 'react'
import ActivateAccountPage from '../../components/activate-account'

export default function Index() {
  return (
    <div>
      <ActivateAccountPage />
    </div>
  )
}

// Force server-side rendering to avoid static build errors
// caused by useRouter() and query parameters.
export async function getServerSideProps() {
  return {
    props: {},
  };
}
