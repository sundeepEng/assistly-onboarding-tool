// src/utils/export/pdf/PdfTheme.ts

import { rgb } from 'pdf-lib';

export const PdfTheme = {
    page: {
        margin: 40,
    },

    colors: {
        primary: rgb(0.36, 0.36, 1),
        text: rgb(0.15, 0.15, 0.15),
        gray: rgb(0.45, 0.45, 0.45),
        lightGray: rgb(0.92, 0.92, 0.92),
    },

    font: {
        title: 24,
        subtitle: 14,
        body: 11,
        small: 9,
    },
};