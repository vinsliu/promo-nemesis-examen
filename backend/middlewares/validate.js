// Valide body / params avec un schéma Joi, retire les champs inconnus (mass assignment)
// et remplace la valeur par la version nettoyée.
const options = { abortEarly: true, stripUnknown: true };

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
