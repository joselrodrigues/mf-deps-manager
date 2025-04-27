#!/usr/bin/env node
import { createCLI } from '../dist/index.js';

// Este es un CLI genérico que puede ser usado directamente
// o extendido por otros paquetes

const cli = createCLI({
  catalogPath: process.cwd(),
  categories: [], // Esto se debe configurar por el paquete que use esta librería
});

cli.run(process.argv);
