import { ThemeProvider, createTheme } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Fragment, useEffect } from "react";
import Modal from "react-modal";
import { Provider } from "react-redux";
import { RoleProvider } from "../components/role-provider";
import store from "../redux/store";
import "./global.css";
import Script from "next/script";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function MyApp(props: AppProps) {
  const { Component, pageProps } = props;

  useEffect(() => {
    // Set the root app element
    Modal.setAppElement("#__next");
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side");
    if (jssStyles && jssStyles.parentElement) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, []);

  const muiTheme = createTheme();

  return (
    <Fragment>
      <Head>
        <title>Assistly</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
        <meta name="robots" content="noindex, nofollow" />
        {/* <meta
                    name="description"
                    content="Assistly helps manage personal care homes with ease. Support for senior living, medication tracking, caregiving, and more."
                />
                <meta
                    name="keywords"
                    content="assistly, personal care home, personal caregiver, senior living, medication management, elderly care, senior care, nursing home, home health care, assisted living"
                /> */}
        <meta name="author" content="Assistly Team" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </Head>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
        strategy="afterInteractive"
      />
      <Provider store={store}>
        <ThemeProvider theme={muiTheme}>
          <QueryClientProvider client={queryClient}>
            {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
            <CssBaseline />
            <RoleProvider>
              <Component {...pageProps} />
            </RoleProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </Provider>
    </Fragment>
  );
}
