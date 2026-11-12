import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'

// Typed versions of the Redux hooks
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const  useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// This custom hook is a typed version of the useDispatch hook.
// Normally, when using useDispatch(), it returns a generic dispatch function, which might not have type safety for your Redux actions.
// By providing AppDispatch as the return type, it ensures that any action dispatched is correctly typed according to the store's dispatch type.
