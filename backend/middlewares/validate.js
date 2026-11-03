/**
 * @module middlewares/validate
 */
// Valide body / params avec un schéma Joi, retire les champs inconnus (mass assignment)
// et remplace la valeur par la version nettoyée.
const options = { abortEarly: true, stripUnknown: true };

/**
 * Fabrique un middleware qui valide `req.params` et `req.body` avec des schémas Joi.
 * Retire les champs inconnus et répond 400 avec le premier message d'erreur.
 * @param {object} schema - Schémas Joi : `params` et/ou `body`.
 * @returns {express.RequestHandler}
 */
module.exports = function validate(schema) {
  return (req, res, next) => {
    for (const source of ['params', 'body']) {
      if (!schema[source]) continue;
      const { error, value } = schema[source].validate(req[source] ?? {}, options);
      if (error) return res.status(400).json({ message: error.details[0].message });
      req[source] = value;
    }
    return next();
  };
};
