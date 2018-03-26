const {models} = require('./model');
const {log, biglog, errorlog, colorize} = require('./out');
const Sequelize = require('sequelize');

/**
 * Muestra la ayuda.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 */
exports.helpCmd = (socket, rl) => {
    log(socket, 'Comandos:');
    log(socket, ' h|help - Muestra ayuda.');
    log(socket, ' list - Listar los quizzes existentes.');
    log(socket, ' show <id> - Muestra la pregunta y la respuesta del quiz indicado');
    log(socket, ' add - Añadir un nuevo quiz interactivamente.');
    log(socket, ' delete <id> - Borrar el quiz indicado.');
    log(socket, ' edit <id> - Editar el quiz indicado.');
    log(socket, ' test <id> - Probar el quiz indicado.');
    log(socket, ' p|play - Jugar a preguntar aleatoriamente todos los quizzes.');
    log(socket, ' credits - Créditos.');
    log(socket, ' q|quit - Salir del programa.');
    rl.prompt();
};


/**
 * Terminar el programa.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 */
exports.quitCmd = (socket, rl) => {
    rl.close();
    socket.end();
};

/**
 * Esta función convierte la llamada rl.question que esta basada en callbacks, en un
 * basada en promesas.
 *
 * Esta funcion devuelve una promesa que cuando se cumple, proporciona el texto intro
 * Entonces la llamada a then que hay que hacer la promesa devuelta sera:
 *      .then(answer => {...})
 *
 * Tambien colorea en rojo el texto de la pregunta, elimina espacios al principio y
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param text Pregunta que hay que hacerle al usuario.
 */
const makeQuestion = (rl, text) => {

    return new Sequelize.Promise((resolve, reject) => {
        rl.question(colorize(text, 'red'), answer => {
            resolve(answer.trim());
        });
    });
};


/**
 * Añade un nuevo quiz al modelo.
 * Pregunta interactivamente por la pregunta y por la respuesta.
 *
 * Hay que recordar que el funcionamiento de la funcion rl.question es asíncrono.
 * El prompt hay que sacarlo cuando ya se ha terminado la interacción con el usuario,
 * es decir, la llamada a rl.prompt() se debe hacer en la callback de la segunda
 * llamada a rl.question.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 */
exports.addCmd = (socket, rl) => {

   makeQuestion(rl, 'Introduzca una pregunta: ')
   .then(q => {
       return makeQuestion(rl, 'Introduzca la respuesta ')
           .then(a => {
               return {question: q, answer: a};
           });
   })
   .then(quiz => {
       return models.quiz.create(quiz);
   })
   .then(quiz => {
       log(socket, ` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
   })
   .catch(Sequelize.ValidationError, error => {
       errorlog(socket, 'El quiz es erroneo:');
       error.errors.forEach(({message}) => errorlog(socket, message));
   })
   .catch(error => {
       errorlog(socket, error.message);
   })
   .then(() => {
       rl.prompt();
   });
};


/**
 * Lista todos los quizzes existentes en el modelo.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 */
exports.listCmd = (socket, rl) => {

    models.quiz.findAll()
    .each(quiz => {
        log(socket, `[${colorize(quiz.id, 'magenta')}]: ${quiz.question} `);
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });
};

/**
 * Esta funcion devuelve una promesa que:
 *  -Valida que se ha introducido un valor para el parametro.
 *  -Convierte el parametro en un numero entero.
 * Si tod va bien ,la promesa se satisface y devuelve el valor de id a usar.
 *
 * @param id Parametro con el indice a validar.
 */
const validateId = id => {

    return new Sequelize.Promise((resolve, reject) => {
        if (typeof id === "undefined") {
            reject(new Error(`Falta el parametro <id>.`));
        } else {
            id = parseInt(id); // coger la parte entera y descartar lo demas
            if (Number.isNaN(id)) {
                reject(new Error(`El valor del parámetro <id> no es un número.`));
            } else {
                resolve(id);
            }
        }
    });
};

/**
 * Muestra el quiz indicado en el parámetro: la pregunta y la respuesta.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 * @param id Clave del quiz a mostrar.
 */
exports.showCmd = (socket, rl, id) => {

    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if (!quiz) {
            throw new Error(`No existe un quiz asociado al id=${id}.`);
        }
        log(socket, `[${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });
};


/**
 * Prueba un quiz, es decir, hace una pregunta del modelo a la que debemos contestar.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 * @param id Clave del quiz a probar en el modelo.
 */
exports.testCmd = (socket, rl, id) => {

    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if (!quiz) {
                throw new Error(`No existe un quiz asociado al id=${id}.`);
            }
            return makeQuestion(rl, `${quiz.question}? `)
                    // return makeQuestion(rl, quiz.answer)
                .then(a => {
                        if (a.trim().toLowerCase() === quiz.answer.trim().toLowerCase()) {
                            log(socket, 'Su respuesta es correcta.');
                            biglog(socket, 'Correcta', 'green');
                        } else {
                            log(socket, 'Su respuesta es incorrecta.');
                            biglog(socket, 'Incorrecta', 'red');
                        }
                    });
        })
    .catch(Sequelize.ValidationError, error => {
        errorlog(socket, 'El quiz es erroneo:');
        error.errors.forEach(({message}) => errorlog(socket, message));
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });
};


/**
 * Pregunta todos los quizzes existentes en el modelo en orden aleatorio.
 * Se gana si se contesta a todos satisfactoriamente.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 */
exports.playCmd = (socket, rl) => {

    let score = 0;

    let toBeResolved = [];

    const playOne = () => {

        return Promise.resolve()
            .then(() => {

                if (toBeResolved.length <= 0) {
                    log(socket, "No hay nada más que preguntar. ");
                    log(socket, `Fin del juego. Aciertos: ${score}`);
                    biglog(socket, `${score}`, "magenta");
                    rl.prompt();
                    return;
                }

                let id = Math.floor(Math.random() * toBeResolved.length);
                let quiz = toBeResolved[id];
                toBeResolved.splice(id, 1);

                makeQuestion(rl, `${quiz.question}: `)
                    .then(answer => {
                        if (answer.trim().toLowerCase() === quiz.answer.trim().toLowerCase()) {
                            score++;
                            log(socket, `CORRECTO - Lleva ${score} aciertos`);
                            playOne();
                        } else {
                            log(socket, "INCORRECTO");
                            log(socket, `Fin del juego. Aciertos: ${score}`);
                            biglog(socket, `${score}`, "magenta");
                            rl.prompt();
                        }
                    })
            })
    };
    models.quiz.findAll({raw: true})
        .then(quizzes => {
            toBeResolved = quizzes;
        })
        .then(() => {
            playOne();
        })
        .catch(e => {
            socket.write("Error: "+ e);
        })
};


/**
 * Edita un quiz del modelo.
 *
 * Hay que recordar que el funcionamiento de la funcion rl.question es asíncrono.
 * El prompt hay que sacarlo cuando ya se ha terminado la interacción con el usuario,
 * es decir, la llamada a rl.prompt() se debe hacer en la callback de la segunda
 * llamada a rl.question.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 * @param id Clave del quiz a editar en el modelo.
 */
exports.editCmd = (socket, rl, id) => {

    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if (!quiz) {
            throw new Error(`No existe un quiz asociado al id=${id}.`);
        }
        process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)},0);
        return makeQuestion(rl, 'Introduzca la pregunta: ')
        .then(q => {
            process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)},0);
            return makeQuestion(rl, 'Introduzca la respuesta ')
            .then(a => {
                quiz.question = q;
                quiz.answer = q;
                return quiz;
            });
        });
    })
    .then(quiz => {
        return quiz.save();
    })
    .then(quiz => {
        log(socket, ` Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
    })
    .catch(Sequelize.ValidationError, error => {
        errorlog(socket, 'El quiz es erroneo:');
        error.errors.forEach(({message}) => errorlog(socket, message));
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });
};


/**
 * Borra un quiz del modelo.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 * @param id Clave del quiz a borrar en el modelo.
 */
exports.deleteCmd = (socket, rl, id) => {

    validateId(id)
        .then(id => models.quiz.destroy({where: {id}}))
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


/**
 * Muestra los nombres de los autores de la práctica.
 *
 * @param rl Objeto readLine usado para implementar el CLI.
 */
exports.creditsCmd = (socket, rl) => {
    log(socket, 'Autor de la práctica:');
    log(socket, 'DANIEL', 'green');
    rl.prompt();
};