/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"=\", \"}\" or [a-zA-Z$_] but \"<\" found. at undefined:1376:10";}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> - <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> s'ha arribat al límit de configuració del lloc web de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hora";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hora";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> s'ha superat el límit de la configuració del lloc web de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hora";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hora";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> s'ha superat el límit de la configuració del lloc web de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "Hi ha ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 no llegit</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " no llegits</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 nou</a> tema";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nous</a> temes";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restants, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "navegueu per altres temes en ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Esteu a punt de suprimir ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> publicació";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> publicacions";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> tema";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> temes";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " d'aquest usuari, suprimir el seu compte, blocar identificacions des de l'adreça IP <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> i afegir l'adreça de correu electrònic <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> a una llista de bloqueig permanent. Esteu segur que aquest usuari realment genera brossa?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Aquest tema té ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 resposta";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " respostes";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "amb una proporció alta de 'm'agrada' per publicació";
return r;
},
"med" : function(d){
var r = "";
r += "amb una proporció molt alta de 'm'agrada' per publicació";
return r;
},
"high" : function(d){
var r = "";
r += "amb una proporció extremament alta de 'm'agrada' per publicació";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "Esteu a punt de suprimir ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 publicació";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " publicacions";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " i ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 tema";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " temes";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Esteu segur?";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ca"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.ca = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"ca":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","time_with_zone":"h:mm (z)","timeline_date":"MMM YYYY","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM YYYY HH:mm","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"D MMMM YYYY","long_date_with_year":"D MMM 'YY HH:mm","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eHH:mm","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eHH:mm","wrap_ago":"fa %{date} ","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}h","other":"%{count} h"},"x_days":{"one":"%{count}d","other":"%{count} d"},"x_months":{"one":"%{count} mes","other":"%{count} mesos"},"about_x_years":{"one":"%{count} a","other":"%{count} a"},"over_x_years":{"one":"\u003e %{count} a","other":"\u003e %{count} a"},"almost_x_years":{"one":"%{count} a","other":"%{count} a"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} min","other":"%{count} min"},"x_hours":{"one":"%{count} hora","other":"%{count} hores"},"x_days":{"one":"%{count} dia","other":"%{count} dies"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"fa %{count} minut","other":"fa %{count} minuts"},"x_hours":{"one":"fa %{count} hora","other":"fa %{count} hores"},"x_days":{"one":"fa %{count} dia","other":"fa %{count} dies"},"x_months":{"one":"fa %{count} mes","other":"fa %{count} mesos"},"x_years":{"one":"fa %{count} any","other":"fa %{count} anys"}},"later":{"x_days":{"one":"%{count} dia després","other":"%{count} dies després"},"x_months":{"one":"%{count} mes després","other":"%{count} mesos després"},"x_years":{"one":"%{count} any després","other":"%{count} anys després"}},"previous_month":"Mes anterior","next_month":"Mes següent","placeholder":"data"},"share":{"topic_html":"Tema: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"publicació #%{postNumber}","close":"tanca","twitter":"Comparteix aquest enllaç en Twitter","facebook":"Comparteix aquest enllaç a Facebook","email":"Envia aquest enllaç en un correu electrònic"},"action_codes":{"public_topic":"tema fet públic %{when}","private_topic":"s'ha convertit el tema en un missatge personal %{when}","split_topic":"s'ha dividit el tema %{when}","invited_user":"s'ha convidat %{who} %{when}","invited_group":"s'ha convidat %{who} %{when}","user_left":"%{who} s'ha suprimit d'aquest missatge %{when}","removed_user":"s'ha suprimit %{who} %{when}","removed_group":"ha suprimit %{who} %{when}","autobumped":"elevat automàticament %{when}","autoclosed":{"enabled":"tancat %{when}","disabled":"obert %{when}"},"closed":{"enabled":"tancat %{when}","disabled":"obert %{when}"},"archived":{"enabled":"arxivat %{when}","disabled":"desarxivat %{when}"},"pinned":{"enabled":"afixat %{when}","disabled":"desafixat %{when}"},"pinned_globally":{"enabled":"afixat globalment %{when}","disabled":"desclavat %{when}"},"visible":{"enabled":"s'ha fet visible %{when}","disabled":"s'ha fet invisible %{when}"},"banner":{"enabled":"convertit en bàner %{when}. Apareixerà a dalt de cada pàgina fins que sigui descartat per l'usuari.","disabled":"ha suprimit aquest bàner %{when}. No apareixerà més a dalt de cada pàgina."}},"topic_admin_menu":"accions del tema","wizard_required":"Us donem la benvinguda al vostre nou Discourse! Comencem amb \u003ca href='%{url}' data-auto-route='true'\u003el'assistent de configuració\u003c/a\u003e ✨","emails_are_disabled":"Tots els correus sortints han estat globalment inhabilitats per un administrador. No s'enviarà cap notificació de cap mena per correu electrònic.","bootstrap_mode_enabled":"Per a facilitar el llançament del vostre lloc web nou, esteu en mode d'arrencada. Tots els usuaris nous tindran el nivell de confiança 1 i tindran activitats els correus de resum diari. Això es desactivarà automàticament quan s'hi hagin unit %{min_users} usuaris.","bootstrap_mode_disabled":"El mode d'arrencada serà desactivat d'aquí a 24 hores.","themes":{"default_description":"Per defecte","broken_theme_alert":"Pot ser que el vostre lloc web no funcioni perquè l'aparença o component %{theme} té errors. Inhabiliteu-lo en %{path}."},"s3":{"regions":{"ap_northeast_1":"Àsia Pacífic (Tòquio)","ap_northeast_2":"Àsia Pacífic (Seül)","ap_south_1":"Àsia Pacífic (Mumbai)","ap_southeast_1":"Àsia Pacífic (Singapur)","ap_southeast_2":"Àsia Pacífic (Sydney)","ca_central_1":"Canadà (central)","cn_north_1":"Xina (Beijing)","cn_northwest_1":"la Xina (Ningxia)","eu_central_1":"UE (Frankfurt)","eu_north_1":"UE (Stockholm)","eu_west_1":"UE (Irlanda)","eu_west_2":"UE (Londres)","eu_west_3":"UE (París)","sa_east_1":"Sud-amèrica (São Paulo)","us_east_1":"EUA Est (N. Virginia)","us_east_2":"EUA Est (Ohio)","us_gov_east_1":"AWS GovCloud (est dels EUA)","us_gov_west_1":"AWS GovCloud (oest dels EUA)","us_west_1":"EUA Oest (N. Califòrnia)","us_west_2":"EUA Oest (Oregon)"}},"edit":"edita el títol i la categoria d'aquest tema","expand":"Expandeix","not_implemented":"Ho sentim! Aquesta funcionalitat encara no s'ha implementat.","no_value":"No","yes_value":"Sí","submit":"Envia","generic_error":"Ho sentim, s'ha produït un error.","generic_error_with_reason":"Hi ha hagut un error: %{error}","go_ahead":"Avant","sign_up":"Registre","log_in":"Inicia sessió","age":"Edat","joined":"Registrat","admin_title":"Admin","show_more":"mostra'n més","show_help":"opcions","links":"Enllaços","links_lowercase":{"one":"enllaç","other":"enllaços"},"faq":"PMF","guidelines":"Directrius","privacy_policy":"Política de privacitat","privacy":"Privacitat","tos":"Condicions del servei","rules":"Regles","conduct":"Codi de Conducta","mobile_view":"Vista mòbil","desktop_view":"Vista d'escriptori","you":"Vós","or":"o","now":"ara mateix","read_more":"llegeix més","more":"Més","less":"Menys","never":"mai","every_30_minutes":"cada 30 minuts","every_hour":"cada hora","daily":"diari","weekly":"setmanal","every_month":"cada mes","every_six_months":"cada sis mesos","max_of_count":"màxim de {{count}}","alternation":"o","character_count":{"one":"{{count}} caràcter","other":"{{count}} caràcters"},"related_messages":{"title":"Missatges relacionats","see_all":"Mostra \u003ca href=\"%{path}\"\u003etots els missatges\u003c/a\u003e de @%{username}..."},"suggested_topics":{"title":"Temes recomanats","pm_title":"Missatges recomanats"},"about":{"simple_title":"Quant a","title":"Quant a %{title}","stats":"Estadístiques del lloc web","our_admins":"Administradors","our_moderators":"Moderadors","moderators":"Moderadors","stat":{"all_time":"Sempre","last_7_days":"Darrers 7","last_30_days":"Darrers 30"},"like_count":"'M'agrada'","topic_count":"Temes","post_count":"Publicacions","user_count":"Usuaris","active_user_count":"Usuaris actius","contact":"Contacta amb nosaltres","contact_info":"En cas d'una qüestió urgent o greu que afecti aquest lloc web, contacteu amb nosaltres en: %{contact_info}."},"bookmarked":{"title":"Preferit","clear_bookmarks":"Neteja preferits","help":{"bookmark":"Feu clic per a marcar com a preferit la primera publicació d'aquest tema","unbookmark":"Feu clic per a eliminar tots els preferits d'aquest tema"}},"bookmarks":{"created":"heu marcat aquesta publicació com a preferit","not_bookmarked":"marca aquesta publicació com a preferit","remove":"Elimina preferit","confirm_clear":"Esteu segur que voleu eliminar tots els preferits d'aquest tema?","save":"Desa","reminders":{"later_today":"Més tard avui","tomorrow":"Demà","next_week":"La setmana que ve","later_this_week":"Més avant aquesta setmana","next_month":"El mes que ve"}},"drafts":{"resume":"Reprèn","remove":"Elimina","new_topic":"Esborrany de tema nou","new_private_message":"Esborrany de nou missatge privat","topic_reply":"Esborrany de resposta","abandon":{"confirm":"Ja heu obert un altre esborrany en aquest tema. Esteu segur que voleu abandonar-lo?","yes_value":"Sí, abandona","no_value":"No, segueix"}},"topic_count_latest":{"one":"Vegeu {{count}} tema nou o actualitzat","other":"Vegeu {{count}} temes nous o actualitzats"},"topic_count_unread":{"one":"Vegeu {{count}} tema no llegit ","other":"Vegeu {{count}} temes no llegits"},"topic_count_new":{"one":"Vegeu {{count}} tema nou","other":"Vegeu {{count}} temes nous"},"preview":"previsualitza","cancel":"cancel·la","save":"Desa els canvis","saving":"Desant...","saved":"Desat!","upload":"Carrega","uploading":"Carregant...","uploading_filename":"Pujant: {{filename}}...","clipboard":"porta-retalls","uploaded":"Carregat!","pasting":"Enganxant...","enable":"Activa","disable":"Desactiva","continue":"Continua","undo":"Desfés","revert":"Reverteix","failed":"Ha fallat","switch_to_anon":"Entra en el mode anònim","switch_from_anon":"Surt del mode anònim","banner":{"close":"Descarta aquesta bandera.","edit":"Edita aquesta bandera \u003e\u003e"},"pwa":{"install_banner":"Voleu \u003ca href\u003einstal·lar %{title} en aquest dispositiu?\u003c/a\u003e"},"choose_topic":{"none_found":"No s'ha trobat temes.","title":{"search":"Cerca un tema","placeholder":"escriviu el títol, l’URL o l’identificador del tema aquí"}},"choose_message":{"none_found":"No s'han trobat missatges."},"review":{"order_by":"Ordena per","in_reply_to":"en resposta a","explain":{"why":"expliqueu per què aquest element ha acabat a la cua","title":"Puntuació revisable","formula":"Fórmula","subtotal":"Subtotal","total":"Total","min_score_visibility":"Puntuació mínima per a visibilitat","score_to_hide":"Puntuació per a amagar la publicació","take_action_bonus":{"name":"ha actuat","title":"Quan un membre de l'equip responsable decideix actuar, es dóna una bonificació a la bandera. "},"user_accuracy_bonus":{"name":"precisió de l’usuari","title":"Es dóna una bonificació als usuaris que hagin creat banderes amb les quals històricament s'hagi estat d'acord. "},"trust_level_bonus":{"name":"nivell de confiança","title":"Els elements revisables creats per usuaris de nivell superior de confiança tenen una puntuació més alta."},"type_bonus":{"name":"bonificació tipus","title":"El personal pot assignar una bonificació a certs tipus revisables perquè tinguin una prioritat més alta."}},"claim_help":{"optional":"Podeu reclamar aquest element per a impedir que altres el revisin.","required":"Heu de reclamar elements abans de poder revisar-los","claimed_by_you":"Heu reclamat aquest element i podeu revisar-lo","claimed_by_other":"Aquest element sols pot ser revisat per \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"reclama aquest tema"},"unclaim":{"help":"elimina aquesta reclamació"},"awaiting_approval":"Esperant aprovació","delete":"Suprimeix","settings":{"saved":"Desat","save_changes":"Desa els canvis","title":"Configuració","priorities":{"title":"Prioritats revisables"}},"moderation_history":"Historial de moderació","view_all":"Mostra'ls tots","grouped_by_topic":"Agrupats per tema","none":"No hi ha elements per a revisar.","view_pending":"mostra els pendents","topic_has_pending":{"one":"Aquest tema té \u003cb\u003e%{count}\u003c/b\u003e publicació pendent d'aprovar","other":"Aquest tema té \u003cb\u003e{{count}}\u003c/b\u003e publicacions pendents d'aprovar"},"title":"Revisa","topic":"Tema:","filtered_topic":"Heu filtrat a contingut revisable en un sol tema.","filtered_user":"Usuari","show_all_topics":"mostra tots els temes","deleted_post":"(publicació suprimida)","deleted_user":"(usuari suprimit)","user":{"bio":"Biografia","username":"Nom d'usuari","email":"Correu electrònic","name":"Nom","fields":"Camps"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} bandera en total)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} banderes en total)"},"agreed":{"one":"El {{count}}% hi està d'acord","other":"El {{count}}% hi està d'acord"},"disagreed":{"one":"El {{count}}% hi està en desacord","other":"El {{count}}% hi està en desacord"},"ignored":{"one":"El {{count}}% ho ignora","other":"El {{count}}% ho ignora"}},"topics":{"topic":"Tema","reviewable_count":"Recompte","reported_by":"Reportat per","deleted":"[Tema suprimit]","original":"(tema original)","details":"detalls","unique_users":{"one":"%{count} usuari","other":"{{count}} usuaris"}},"replies":{"one":"%{count} resposta","other":"{{count}} respostes"},"edit":"Edita","save":"Desa","cancel":"Cancel·la","new_topic":"Aprovar aquest element crearà un tema nou","filters":{"all_categories":"(totes les categories)","type":{"title":"Tipus","all":"(tots els tipus)"},"minimum_score":"Puntuació mínima:","refresh":"Actualitza","status":"Estat","category":"Categoria","orders":{"priority":"Prioritat","priority_asc":"Prioritat (inversa)","created_at":"Creat","created_at_asc":"Creat (invers)"},"priority":{"title":"Prioritat mínima","low":"(qualsevol)","medium":"Mitjana","high":"Alta"}},"conversation":{"view_full":"mostra la conversa sencera"},"scores":{"about":"Aquesta puntuació es calcula en funció del nivell de confiança del reportador, de l'exactitud de les banderes prèvies i de la prioritat de l'element del qual es reporta.","score":"Puntuació","date":"Data","type":"Tipus","status":"Estat","submitted_by":"Enviat per","reviewed_by":"Revisat per"},"statuses":{"pending":{"title":"Pendent"},"approved":{"title":"Aprovat"},"rejected":{"title":"Rebutjat"},"ignored":{"title":"Ignorat"},"deleted":{"title":"Suprimit"},"reviewed":{"title":"(tots revisats)"},"all":{"title":"(qualsevol cosa)"}},"types":{"reviewable_flagged_post":{"title":"Publicació amb bandera","flagged_by":"Marcat amb bandera per"},"reviewable_queued_topic":{"title":"Tema en cua"},"reviewable_queued_post":{"title":"Publicació en cua"},"reviewable_user":{"title":"Usuari"}},"approval":{"title":"Cal aprovar la publicació","description":"Hem rebut la vostra nova publicació, però cal que sigui aprovada per un moderador abans d'aparèixer publicada. Tingueu una mica de paciència.","pending_posts":{"one":"Teniu \u003cstrong\u003e%{count}\u003c/strong\u003e publicació pendent.","other":"Teniu \u003cstrong\u003e{{count}}\u003c/strong\u003e publicacions pendents."},"ok":"D'acord"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha publicat \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVós\u003c/a\u003e heu publicat \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha respost a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVós\u003c/a\u003e heu respost \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha respost al \u003ca href='{{topicUrl}}'\u003etema\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eVós\u003c/a\u003e heu respost al \u003ca href='{{topicUrl}}'\u003etema\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e ha mencionat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003eus\u003c/a\u003e ha fet mencionat","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVós\u003c/a\u003e heu mencionat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Publicat per \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Publicat per \u003ca href='{{userUrl}}'\u003evós\u003c/a\u003e","sent_by_user":"Enviat per \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviat per \u003ca href='{{userUrl}}'\u003evós\u003c/a\u003e"},"directory":{"filter_name":"filtra per usuari","title":"Usuaris","likes_given":"Lliurat","likes_received":"Rebut","topics_entered":"Vist","topics_entered_long":"Temes vists","time_read":"Temps llegit","topic_count":"Temes","topic_count_long":"Temes creats","post_count":"Respostes","post_count_long":"Respostes publicades","no_results":"No s'han trobat resultats","days_visited":"Visites","days_visited_long":"Dies visitats","posts_read":"Llegit","posts_read_long":"Publicacions llegides","total_rows":{"one":"%{count} usuari","other":"%{count} usuaris"}},"group_histories":{"actions":{"change_group_setting":"Canvia la configuració del grup","add_user_to_group":"Afegeix usuari","remove_user_from_group":"Elimina usuari","make_user_group_owner":"Converteix en propietari","remove_user_as_group_owner":"Elimina propietari"}},"groups":{"member_added":"Afegit","member_requested":"Sol·licitat","add_members":{"title":"Afegeix membres","description":"Gestiona els membres d'aquest grup","usernames":"Noms d'usuari"},"requests":{"title":"Sol·licituds","reason":"Motiu","accept":"Accepta","accepted":"acceptat","deny":"Denega","denied":"denegat","undone":"sol·licitud revertida","handle":"gestiona la sol·licitud d'afiliació"},"manage":{"title":"Gestiona","name":"Nom","full_name":"Nom complet","add_members":"Afegeix membres","delete_member_confirm":"Voleu eliminar '%{username}' del grup '%{group}'?","profile":{"title":"Perfil"},"interaction":{"title":"Interacció","posting":"Publicant","notification":"Notificació"},"membership":{"title":"Membres","access":"Accés"},"logs":{"title":"Registres","when":"Quan","action":"Acció","acting_user":"Usuari actiu","target_user":"Usuari destinatari","subject":"Assumpte","details":"Detalls","from":"De","to":"A"}},"public_admission":"Permet als usuaris d'unir-se al grup lliurement (cal que el grup sigui visible públicament)","public_exit":"Permet que els usuaris abandonin el grup lliurement","empty":{"posts":"No hi ha publicacions de membres d'aquest grup.","members":"No hi ha membres en aquest grup.","requests":"No hi ha sol·licituds d'afiliació per a aquest grup.","mentions":"No hi ha mencions d'aquest grup.","messages":"No hi ha missatges per a aquest grup.","topics":"No hi ha temes de membres d'aquest grup.","logs":"No hi ha registres (logs) per a aquest grup."},"add":"Afegeix","join":"Registre","leave":"Abandona","request":"Sol·licita","message":"Missatge","allow_membership_requests":"Permet als usuaris d'enviar sol·licituds d'afiliació als propietaris del grup (requereix un grup visible públicament)","membership_request_template":"Plantilla personalitzada que es mostra als usuaris quan envien una sol·licitud d'afiliació","membership_request":{"submit":"Envia sol·licitud","title":"Sol·licitud d'unir-se a @%{group_name}","reason":"Feu saber als propietaris del grup per què sou una persona apropiada per al grup. "},"membership":"Membres","name":"Nom","group_name":"Nom del grup","user_count":"Usuaris","bio":"Quant al grup","selector_placeholder":"introduïu el nom d'usuari","owner":"propietari","index":{"title":"Grups","all":"Tots els grups","empty":"No hi ha grups visibles","filter":"Filtra per tipus de grup","owner_groups":"Grups de què sou propietari","close_groups":"Grups tancats","automatic_groups":"Grups Automàtics","automatic":"Automàtic","closed":"Tancat","public":"Públic","private":"Privat","public_groups":"Grups públics","automatic_group":"Grup automàtic","close_group":"Tanca el grup","my_groups":"Els meus grups","group_type":"Tipus de grup","is_group_user":"Membre","is_group_owner":"Propietari"},"title":{"one":"Grup","other":"Grups"},"activity":"Activitat","members":{"title":"Membres","filter_placeholder_admin":"nom d'usuari o correu","filter_placeholder":"nom d'usuari","remove_member":"Elimina un membre","remove_member_description":"Elimina \u003cb\u003e%{username}\u003c/b\u003e del grup","make_owner":"Crea propietari","make_owner_description":"Fes \u003cb\u003e%{username}\u003c/b\u003e propietari del grup","remove_owner":"Elimina com a propietari","remove_owner_description":"Elimina \u003cb\u003e%{username}\u003c/b\u003e com a propietari del grup","owner":"Propietari","forbidden":"No teniu permís per a veure els membres."},"topics":"Temes","posts":"Publicacions","mentions":"Mencions","messages":"Missatges","notification_level":"Nivell de notificació per defecte per a missatges de grup","alias_levels":{"mentionable":"Qui pot fer @mencions del grup?","messageable":"Qui pot enviar missatges al grup?","nobody":"Ningú","only_admins":"Només administradors","mods_and_admins":"Sols moderadors i administradors","members_mods_and_admins":"Només membres del grup, moderadors i administradors","owners_mods_and_admins":"Sols propietaris del grup, moderadors i administradors","everyone":"Tothom"},"notifications":{"watching":{"title":"Vigilant","description":"Se us notificarà cada nova publicació en tots els missatges, i es mostrarà un recompte de respostes"},"watching_first_post":{"title":"Vigilant la primera publicació","description":"Sereu notificat de missatges nous en aquest grup però no de les respostes als missatges."},"tracking":{"title":"Rastreig","description":"Sereu notificat si algú menciona el vostre @nom o us respon, i es mostrarà un recompte de noves respostes."},"regular":{"title":"Normal","description":"Sereu notificat si algú menciona el vostre @nom o us respon. "},"muted":{"title":"Silenciat","description":"No sereu notificat de res sobre els missatges d'aquest grup."}},"flair_url":"Imatge de l'estil d'avatar","flair_url_placeholder":"(Opcional) Imatge URL o classe Font Awesome ","flair_url_description":"Feu servir imatges quadrades no més petites de 20px per 20 px o icones FontAwesome (formats acceptats: \"fa-icon\", \"far fa-icon\" o \"fab fa-icon\").","flair_bg_color":"Color de fons de l'estil d'avatar ","flair_bg_color_placeholder":"(Opcional) Valor de color hexadecimal","flair_color":"Color de l'estil d'avatar","flair_color_placeholder":"(Opcional) Valor de color hexadecimal","flair_preview_icon":"Previsualitza la icona","flair_preview_image":"Previsualitza la imatge"},"user_action_groups":{"1":"'M'agrada'","2":"'M'agrada'","3":"Preferits","4":"Temes","5":"Respostes","6":"Reaccions","7":"Mencions","9":"Citacions","11":"Edicions","12":"Elements enviats","13":"Safata d'entrada","14":"Pendents","15":"Esborranys"},"categories":{"all":"totes les categories","all_subcategories":"tots","no_subcategory":"cap","category":"Categoria","category_list":"Mostra la llista de categories","reorder":{"title":"Reordena les categories","title_long":"Reorganitza la llista de categories","save":"Desa l'ordre","apply_all":"Aplica","position":"Posició"},"posts":"Publicacions","topics":"Temes","latest":"Més recents","latest_by":"més recent per","toggle_ordering":"commuta el control de l'ordre","subcategories":"Subcategories","topic_sentence":{"one":"%{count} tema","other":"%{count} temes"},"topic_stat_sentence_week":{"one":"%{count} tema nou la setmana passada.","other":"%{count} temes nous la setmana passada. "},"topic_stat_sentence_month":{"one":"%{count} tema nou el mes passat.","other":"%{count} temes nous el mes passat. "},"n_more":"Categories (%{count} més) ..."},"ip_lookup":{"title":"Explora adreça IP","hostname":"Nom d'amfitrió","location":"Ubicació","location_not_found":"(desconegut)","organisation":"Organització","phone":"Telèfon","other_accounts":"Altres comptes amb aquesta adreça IP:","delete_other_accounts":"Suprimeix %{count}","username":"nom d'usuari","trust_level":"nivell de confiança","read_time":"temps de lectura","topics_entered":"temes introduïts","post_count":"nre. de publicacions","confirm_delete_other_accounts":"Esteu segur que voleu suprimir aquests comptes?","powered_by":"utilitzant \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copiat"},"user_fields":{"none":"(trieu una opció)"},"user":{"said":"{{username}}:","profile":"Perfil","mute":"Silencia","edit":"Edita preferències","download_archive":{"button_text":"Descarrega-ho tot","confirm":"Esteu segur que voleu descarregar les vostres publicacions?","success":"Descàrrega iniciada. Quan el procés s'acabi, us ho notificarem amb un missatge.","rate_limit_error":"Les publicacions es poden descarregar una vegada al dia. Torneu a provar-ho demà."},"new_private_message":"Missatge nou","private_message":"Missatge","private_messages":"Missatges","user_notifications":{"ignore_duration_title":"Ignora el temporitzador","ignore_duration_username":"Nom d'usuari ","ignore_duration_when":"Duració:","ignore_duration_save":"Ignora","ignore_duration_note":"Observeu que tots els \"Ignora\" són eliminats automàticament quan expira la duració establerta. ","ignore_duration_time_frame_required":"Seleccioneu un període de temps","ignore_no_users":"No teniu usuaris ignorats.","ignore_option":"Ignorat","ignore_option_title":"No rebreu notificacions relacionades amb aquest usuari i tots els seus temes i respostes seran ocultats.","add_ignored_user":"Afegeix...","mute_option":"Silenciat","mute_option_title":"No rebreu cap notificació relacionada amb aquest usuari.","normal_option":"Normal","normal_option_title":"Sereu notificat si l'usuari us respon, us cita o us menciona."},"activity_stream":"Activitat","preferences":"Preferències","feature_topic_on_profile":{"save":"Desa","clear":{"title":"Neteja"}},"profile_hidden":"El perfil públic d'aquest usuari és ocult. ","expand_profile":"Expandeix","collapse_profile":"Redueix","bookmarks":"Preferits","bio":"Quant a mi","timezone":"Zona horària","invited_by":"Convidat per","trust_level":"Nivell de confiança","notifications":"Notificacions","statistics":"Estats","desktop_notifications":{"label":"Notificacions en directe","not_supported":"Aquest navegador no permet les notificacions. Ho sentim.","perm_default":"Activa les notificacions","perm_denied_btn":"Permís denegat","perm_denied_expl":"Heu denegat el permís per a les notificacions. Les podeu permetre en les preferències del vostre navegador.","disable":"Desactiva les notificacions","enable":"Activa les notificacions","each_browser_note":"Nota: cal canviar aquesta configuració en cada navegador que feu servir.","consent_prompt":"Voleu notificacions en directe quan algú respon a les vostres publicacions?"},"dismiss":"Descarta-ho","dismiss_notifications":"Descarta-ho tot","dismiss_notifications_tooltip":"Marca totes les notificacions no llegides com a llegides","first_notification":"La vostra primera notificació! Seleccioneu-la per a començar.","dynamic_favicon":"Mostra recomptes en la icona del navegador","theme_default_on_all_devices":"Fes que aquesta sigui l'aparença predeterminada en tots els meus dispositius","text_size_default_on_all_devices":"Fes que aquesta sigui la mida de text predeterminada en tots els meus dispositius","allow_private_messages":"Permet a altres usuaris d'enviar-me missatges personals","external_links_in_new_tab":"Obre tots els enllaços externs en una pestanya nova","enable_quoting":"Permet citar la resposta en el text destacat","enable_defer":"Habilita l'ajornament per a marcar temes no llegits","change":"canvia","moderator":"{{user}} és un moderador","admin":"{{user}} és un administrador","moderator_tooltip":"Aquest usuari és un moderador.","admin_tooltip":"Aquest usuari és un administrador","silenced_tooltip":"Aquest usuari és silenciat","suspended_notice":"Aquest usuari és suspès fins a {{date}}.","suspended_permanently":"Aquest usuari és suspès.","suspended_reason":"Motiu:","github_profile":"GitHub","email_activity_summary":"Resum d'activitat","mailing_list_mode":{"label":"Mode de llista de correu","enabled":"Activa el mode de llista de correu","instructions":"Aquesta configuració anul·la la configuració del resum d'activitat.\u003cbr /\u003e\nLes categories i els temes silenciats no s'inclouen en aquests correus electrònics.\n","individual":"Envia un correu per cada nova publicació","individual_no_echo":"Envia un correu per cada nova publicació excepte les meves","many_per_day":"Envia un correu per cada nova publicació (aproximadament {{dailyEmailEstimate}} al dia)","few_per_day":"Envia un correu per cada nova publicació (aproximadament 2 cada dia)","warning":"Mode de llista de correu habilitat. La configuració de notificacions de correu és sobreescrita."},"tag_settings":"Etiquetes","watched_tags":"Vigilat","watched_tags_instructions":"Vigilareu automàticament tots els temes amb aquestes etiquetes. Us notificarem de totes les  publicacions noves i tots els temes nous, i al costat del tema apareixerà un recompte de publicacions noves. ","tracked_tags":"Seguit","tracked_tags_instructions":"Seguireu automàticament tots els temes amb aquestes etiquetes. Apareixerà al costat del tema un recompte de publicacions noves.","muted_tags":"Silenciat","muted_tags_instructions":"No us notificarem res sobre temes nous amb aquestes etiquetes i no apareixeran en més recents.","watched_categories":"Vigilat","watched_categories_instructions":"Vigilareu automàticament tots els temes amb aquestes categories. Us notificarem de totes les publicacions noves i tots els temes nous, i al costat del tema apareixerà un recompte de publicacions noves. ","tracked_categories":"Seguit","tracked_categories_instructions":"Seguireu automàticament tots els temes amb aquestes categories. Al costat del tema apareixerà un recompte de publicacions noves.","watched_first_post_categories":"Vigilant la primera publicació","watched_first_post_categories_instructions":"Us notificarem la primera publicació en cada tema nou en aquestes categories.","watched_first_post_tags":"Vigilant la primera publicació","watched_first_post_tags_instructions":"Us notificarem la primera publicació en cada tema nou amb aquestes etiquetes.","muted_categories":"Silenciat","muted_categories_instructions":"No us notificarem res sobre temes nous en aquestes categories, i no apareixeran en les pàgines de categories o de més recents.","muted_categories_instructions_dont_hide":"No sereu notificat de res sobre temes nous en aquestes categories.","no_category_access":"Com a moderador teniu accés limitat a la categoria. Desar està inhabilitat.","delete_account":"Suprimeix el meu compte","delete_account_confirm":"Esteu segur que voleu suprimir el vostre compte permanentment? Aquesta acció no es pot desfer!","deleted_yourself":"El vostre compte ha estat suprimit amb èxit.","delete_yourself_not_allowed":"Contacteu amb un membre de l'equip responsable si voleu que se suprimeix el vostre compte.","unread_message_count":"Missatges","admin_delete":"Suprimeix","users":"Usuaris","muted_users":"Silenciat","muted_users_instructions":"Suprimeix totes les notificacions d'aquests usuaris","ignored_users":"Ignorat","ignored_users_instructions":"Suprimeix totes les publicacions i les notificacions d'aquests usuaris.","tracked_topics_link":"Mostra","automatically_unpin_topics":"Desafixa automàticament els temes quan jo arribi al final.","apps":"Aplicacions","revoke_access":"Revoca l'accés","undo_revoke_access":"Desfés revocar l'accés","api_approved":"Aprovat:","api_last_used_at":"Utilitzat per darrera vegada:","theme":"Aparença","home":"Pàgina d'inici per defecte","staged":"Fictici","staff_counters":{"flags_given":"banderes útils","flagged_posts":"publicacions amb banderes","deleted_posts":"publicacions suprimides","suspensions":"suspensions","warnings_received":"avisos"},"messages":{"all":"Tot","inbox":"Safata d'entrada","sent":"Enviat","archive":"Arxiva","groups":"Els meus grups","bulk_select":"Selecciona missatges","move_to_inbox":"Mou a la safata d'entrada","move_to_archive":"Arxiva","failed_to_move":"Error en moure els missatges seleccionats (potser ha caigut la xarxa).","select_all":"Selecciona-ho tot","tags":"Etiquetes"},"preferences_nav":{"account":"Compte","profile":"Perfil","emails":"Correus","notifications":"Notificacions","categories":"Categories","users":"Usuaris","tags":"Etiquetes","interface":"Interfície","apps":"Aplicacions"},"change_password":{"success":"(correu electrònic enviat)","in_progress":"(enviant correu electrònic)","error":"(error)","action":"Envia un correu per a restablir la contrasenya","set_password":"Estableix la contrasenya","choose_new":"Trieu una contrasenya nova","choose":"Trieu una contrasenya"},"second_factor_backup":{"title":"Codis de còpia de seguretat de dos factors","regenerate":"Regenera","disable":"Desactiva","enable":"Activa","enable_long":"Activa els codis de còpia de seguretat","manage":"Gestiona els codis de còpia de seguretat. Us resten \u003cstrong\u003e{{count}}\u003c/strong\u003e codis de còpia de seguretat. ","copied_to_clipboard":"Copiat al porta-retalls.","copy_to_clipboard_error":"Error copiant dades al porta-retalls","remaining_codes":"Us resten \u003cstrong\u003e{{count}}\u003c/strong\u003e codis de còpia de seguretat.","use":"Utilitza un codi de còpia de seguretat","enable_prerequisites":"Cal habilitar un segon factor primari abans de generar codis de còpia de seguretat.","codes":{"title":"Codis de còpia de seguretat generats","description":"Cada un dels codis de còpia de seguretat es pot fer servir sols una vegada. Manteniu-los en algun lloc web segur però accessible. "}},"second_factor":{"title":"Autenticació de dos factors","enable":"Gestiona l'autenticació de dos factors","forgot_password":"Heu oblidat la contrasenya?","confirm_password_description":"Confirmeu la contrasenya per a continuar","name":"Nom","label":"Codi","rate_limit":"Espereu abans de provar un altre codi d'autenticació.","enable_description":"Escanegeu aquest codi QR en una aplicació permesa (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) i introduïu el vostre codi d'autenticació.\n","disable_description":"Introduïu el codi d'autenticació des de la vostra aplicació.","show_key_description":"Introduïu-lo manualment","short_description":"Protegiu el vostre compte amb codis de seguretat d'un sol ús.\n","extended_description":"L'autenticació de dos factors afegeix seguretat addicional al vostre compte exigint un testimoni únic a més de la vostra contrasenya. Es poden generar testimonis en dispositius \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e i \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e.\n","oauth_enabled_warning":"Observeu que els inicis de sessió amb xarxes socials seran deshabilitats quan l'autenticació de dos factors s'hagi activat en el vostre compte. ","use":"Utilitza l'aplicació Authenticator","enforced_notice":"Cal que activeu l'autenticació de dos factors abans d'accedir a aquest lloc web.","disable":"deshabilita","disable_title":"Deshabilita el segon factor","disable_confirm":"Esteu segur que voleu deshabilitar tots els factors segons?","edit":"Edita","edit_title":"Edita el factor segon","edit_description":"Nom del factor segon","enable_security_key_description":"Quan tingueu preparada la vostra clau de seguretat física, premeu el botó Registre.","totp":{"title":"Autenticadors basats en testimonis","add":"Autenticador nou","default_name":"El meu autenticador"},"security_key":{"register":"Registre","title":"Claus de seguretat","add":"Registra la clau de seguretat","default_name":"Clau de seguretat principal","not_allowed_error":"El procés de registre de claus de seguretat ha arribat al límit de temps o s'ha cancel·lat. ","already_added_error":"Ja heu registrat aquesta clau de seguretat. No cal que la registreu de nou.","edit":"Edita la clau de seguretat","edit_description":"Nom de la clau de seguretat","delete":"Suprimeix"}},"change_about":{"title":"Canvia Quant a mi","error":"Hi ha hagut un error en canviar aquest valor"},"change_username":{"title":"Canvia el nom d'usuari","confirm":"Esteu del tot segur que voleu canviar el nom d'usuari?","taken":"Aquest nom d'usuari ja està agafat.","invalid":"El nom d'usuari no és vàlid. Ha d'incloure només xifres i lletres."},"change_email":{"title":"Canvi de correu","taken":"Aquest correu electrònic no està disponible.","error":"Hi ha hagut un error en canviar el vostre correu electrònic. Potser aquesta adreça ja està en ús. ","success":"Hem enviat un correu electrònic a aquesta adreça. Seguiu les instruccions de confirmació.","success_staff":"S'ha enviat un missatge a la vostra adreça actual. Seguiu les instruccions de confirmació."},"change_avatar":{"title":"Canvia la foto de perfil","gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e, basat en","gravatar_title":"Canvieu el vostre avatar en el lloc web de {{gravatarName}}","gravatar_failed":"No hem trobat un {{gravatarName}} amb aquesta adreça de correu electrònic.","refresh_gravatar_title":"Actualitzeu el vostre {{gravatarName}}","letter_based":"Foto de perfil assignada pel sistema","uploaded_avatar":"Foto personalitzada","uploaded_avatar_empty":"Afegeix una foto personalitzada","upload_title":"Carrega la foto","image_is_not_a_square":"Atenció: hem retallat la vostra imatge; l'amplada i l'alçada no eren iguals."},"change_profile_background":{"title":"Capçalera de perfil","instructions":"Les capçaleres de perfil estaran centrades i tindran una amplada predeterminada de 1110px."},"change_card_background":{"title":"Fons de la targeta d'usuari","instructions":"Les imatges de fons se centraran i tindran una amplada per defecte de 590px."},"email":{"title":"Correu electrònic","primary":"Adreça de correu primària","secondary":"Adreces de correu secundàries","no_secondary":"Sense adreces de correu secundàries","sso_override_instructions":"L'adreça de correu es pot actualitzar des d'un proveïdor SSO","instructions":"No es mostra mai en públic.","ok":"Us enviarem un correu electrònic de confirmació","invalid":"Introduïu una adreça vàlida de correu electrònic","authenticated":"El vostre correu electrònic ha estat autenticat per {{provider}}","frequency_immediately":"Us enviarem un correu immediatament si no heu llegit la cosa sobre la qual us escrivim.","frequency":{"one":"Sols us enviarem un correu electrònic si no us hem vist en el darrer minut.","other":"Sols us enviarem un correu electrònic si no us hem vist en els darrers {{count}} minuts."}},"associated_accounts":{"title":"Comptes associats","connect":"Connecta","revoke":"Revoca","cancel":"Cancel·la","not_connected":"(no connectat)","confirm_modal_title":"Connecta el compte %{provider}","confirm_description":{"account_specific":"El vostre compte %{provider} '%{account_description}' es farà servir per a autenticació.","generic":"El vostre compte %{provider} es farà servir per a l'autenticació."}},"name":{"title":"Nom","instructions":"el vostre nom complet (opcional)","instructions_required":"El vostre nom complet","too_short":"El vostre nom és massa curt","ok":"El vostre nom sona bé"},"username":{"title":"Nom d'usuari","instructions":"únic, sense espais, breu","short_instructions":"La gent us pot mencionar com a @{{username}}","available":"El nom d'usuari està disponible","not_available":"No està disponible. I si proveu amb {{suggestion}}?","not_available_no_suggestion":"No disponible","too_short":"El nom d'usuari és massa breu","too_long":"El nom d'usuari és massa llarg","checking":"Comprovant si el nom d'usuari està disponible...","prefilled":"L'adreça electrònica coincideix amb aquest nom d'usuari registrat"},"locale":{"title":"Llengua de la interfície","instructions":"Llengua de la interfície d'usuari. Canviarà quan actualitzeu la pàgina.","default":"(per defecte)","any":"qualsevol"},"password_confirmation":{"title":"Contrasenya una altra vegada"},"auth_tokens":{"title":"Dispositius utilitzats recentment","ip":"IP","details":"Detalls","log_out_all":"Tanca totes les sessions","active":"actius ara","not_you":"No sou vós?","show_all":"Mostra'ls tots ({{count}})","show_few":"Mostra'n menys","was_this_you":"Heu estat vós?","was_this_you_description":"Si no heu estat vós, us recomanem que canvieu la contrasenya i que tanqueu les sessions a tot arreu.","browser_and_device":"{{browser}} en {{device}}","secure_account":"Fes segur el meu compte","latest_post":"L'última cosa que heu publicat..."},"last_posted":"Darrer missatge","last_emailed":"Darrer correu","last_seen":"Vist","created":"Registrat","log_out":"Tanca la sessió","location":"Ubicació","website":"Lloc web","email_settings":"Correu electrònic","hide_profile_and_presence":"Amaga les característiques del meu perfil i la meva presència públics ","enable_physical_keyboard":"Habilita el suport de teclat físic en iPad","text_size":{"title":"Mida del text","smaller":"Més petit","normal":"Normal","larger":"Més gros","largest":"El més gros"},"title_count_mode":{"title":"El títol de la pàgina de fons mostra el recompte de:","notifications":"Notificacions noves","contextual":"Nou contingut de la pàgina"},"like_notification_frequency":{"title":"Notifica'm quan tingui 'm'agrada'","always":"Sempre","first_time_and_daily":"La primera vegada que una publicació rep un 'M'agrada' i diàriament","first_time":"La primera vegada que una publicació rep un 'M'agrada'","never":"Mai"},"email_previous_replies":{"title":"Inclou respostes prèvies al final dels correus electrònics","unless_emailed":"llevat que hagi estat enviat prèviament","always":"sempre","never":"mai"},"email_digests":{"title":"Quan no visito el lloc web, envia'm un missatge de resum de temes i respostes populars.","every_30_minutes":"cada 30 minuts","every_hour":"cada hora","daily":"cada dia","weekly":"cada setmana","every_month":"cada mes","every_six_months":"cada sis mesos"},"email_level":{"title":"Envia'm un correu quan algú em citi, respongui a una entrada, mencioni el meu @nomdusuari, o m'inviti a un tema","always":"sempre","only_when_away":"només quan sigui absent","never":"mai"},"email_messages_level":"Envia'm un correu quan algú m'enviï un missatge","include_tl0_in_digests":"Inclou contingut d'usuaris nous en els correus de resum ","email_in_reply_to":"Inclou un extracte del que s'ha respost a la publicació en els correus.","other_settings":"Altres","categories_settings":"Categories","new_topic_duration":{"label":"Considera els temes nous quan ","not_viewed":"encara no els hagi vist","last_here":"hagin estat creats després de la meva darrera visita","after_1_day":"hagin estat creats durant el darrer dia","after_2_days":"hagin estat creats durant els darrers 2 dies","after_1_week":"hagin estat creats durant la setmana passada","after_2_weeks":"hagin estat creats durant les darreres 2 setmanes"},"auto_track_topics":"Segueix automàticament els temes que jo introdueixi","auto_track_options":{"never":"mai","immediately":"immediatament","after_30_seconds":"al cap de 30 segons","after_1_minute":"al cap d'1 minut","after_2_minutes":"al cap de 2 minuts","after_3_minutes":"al cap de 3 minuts","after_4_minutes":"al cap de 4 minuts","after_5_minutes":"al cap de 5 minuts","after_10_minutes":"al cap de 10 minuts"},"notification_level_when_replying":"Quan jo publiqui en un tema nou, estableix aquest tema a","invited":{"search":"escriu aquí per a cercar invitacions...","title":"Invitacions","user":"Usuari convidat","sent":"Darrer enviat","none":"Cap invitació per a mostrar.","truncated":{"one":"Mostrant la primera invitació.","other":"Mostrant les primeres {{count}} invitacions."},"redeemed":"Invitacions acceptades","redeemed_tab":"Acceptada","redeemed_tab_with_count":"Acceptades ({{count}})","redeemed_at":"Acceptada","pending":"Invitacions pendents","pending_tab":"Pendents","pending_tab_with_count":"Pendents ({{count}})","topics_entered":"Temes vists","posts_read_count":"Publicacions llegides","expired":"Aquesta invitació ha caducat.","rescind":"Elimina","rescinded":"Invitació eliminada","rescind_all":"Elimina totes les invitacions expedides","rescinded_all":"Totes les invitacions expirades eliminades!","rescind_all_confirm":"Esteu segur que voleu eliminar totes les invitacions expirades?","reinvite":"Reenvia la invitació","reinvite_all":"Reenvia totes les invitacions","reinvite_all_confirm":"Esteu segur que voleu reenviar totes les invitacions?","reinvited":"Invitació reenviada","reinvited_all":"Totes les invitacions reenviades!","time_read":"Temps de lectura","days_visited":"Dies visitats","account_age_days":"Antiguitat del compte en dies","create":"Envia una invitació","generate_link":"Copia l'enllaç d'invitació","link_generated":"Enllaç d'invitació generat emb èxit!","valid_for":"L'enllaç d'invitació només és vàlid per a aquesta adreça de correu: %{email}","bulk_invite":{"none":"Encara no heu convidat ningú aquí. Envieu invitacions individuals o convideu molta gent d'un sol cop \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eenviant un fitxer CSV\u003c/a\u003e.","text":"Invitació massiva des de fitxer","success":"Fitxer carregat amb èxit. Us notificarem amb un missatge quan s'hagi completat el procés.","error":"El fitxer hauria de tenir format CSV.","confirmation_message":"Esteu a punt d'enviar invitacions a tothom en el fitxer pujat. "}},"password":{"title":"Contrasenya","too_short":"La contrasenya és massa curta.","common":"La contrasenya és massa freqüent.","same_as_username":"La contrasenya és igual que el nom d'usuari.","same_as_email":"La contrasenya és igual que el correu electrònic.","ok":"La contrasenya té bon aspecte.","instructions":"com a mínim %{count} caràcters"},"summary":{"title":"Resum","stats":"Estadístiques","time_read":"temps de lectura","recent_time_read":"temps de lectura recent","topic_count":{"one":"tema creat","other":"temes creats"},"post_count":{"one":"publicació creada","other":"publicacions creades"},"likes_given":{"one":"donat","other":"donats"},"likes_received":{"one":"rebut","other":"rebuts"},"days_visited":{"one":"dia visitat","other":"dies visitats"},"topics_entered":{"one":"tema vist","other":"temes vists"},"posts_read":{"one":"publicació llegida","other":"publicacions llegides"},"bookmark_count":{"one":"preferit","other":"preferits"},"top_replies":"Respostes principals","no_replies":"Encara sense respostes","more_replies":"Més respostes","top_topics":"Temes principals","no_topics":"Encara no hi ha temes","more_topics":"Més temes","top_badges":"Insígnies principals","no_badges":"Encara no hi ha insígnies","more_badges":"Més insígnies","top_links":"Enllaços principals","no_links":"Encara no hi ha enllaços","most_liked_by":"Ha tingut més 'm'agrada' per","most_liked_users":"Ha tingut més 'm'agrada'","most_replied_to_users":"Amb més respostes","no_likes":"Encara sense :heart:","top_categories":"Categories principals","topics":"Temes","replies":"Respostes"},"ip_address":{"title":"Darrera adreça IP"},"registration_ip_address":{"title":"Registre d'adreça IP"},"avatar":{"title":"Foto de perfil","header_title":"perfil, missatges, preferits i preferències"},"title":{"title":"Títol","none":"(cap)"},"primary_group":{"title":"Grup primari","none":"(cap)"},"filters":{"all":"Tot"},"stream":{"posted_by":"Publicat per","sent_by":"Enviat per","private_message":"missatge","the_topic":"el tema"}},"loading":"Carregant...","errors":{"prev_page":"mentre es prova de carregar","reasons":{"network":"Error de xarxa","server":"Error de servidor","forbidden":"Accés denegat","unknown":"Error","not_found":"Pàgina no trobada"},"desc":{"network":"Comproveu la connexió","network_fixed":"Sembla que ja ha tornat","server":"Codi d'error: {{status}}","forbidden":"No teniu permís per a veure-ho.","not_found":"Ui, l'aplicació ha provat de carregar un URL que no existeix.","unknown":"Alguna cosa ha anat malament"},"buttons":{"back":"Vés enrere","again":"Torna-ho a intentar","fixed":"Carrega la pàgina"}},"modal":{"close":"tanca"},"close":"Tanca","assets_changed_confirm":"El lloc web s'ha actualitzat. Voleu tornar a carregar la pàgina per a la versió més recent?","logout":"Heu tancat la sessió.","refresh":"Actualitza","read_only_mode":{"enabled":"El lloc web és en mode només de lectura. Continueu navegant, però de moment estan desactivades les accions de respondre, 'm'agrada' i altres.","login_disabled":"S'ha desactivat l'inici de sessió mentre aquest lloc web es trobi en mode només de lectura.","logout_disabled":"S'ha desactivat el tancament de sessió mentre aquest lloc web es trobi en mode només de lectura."},"logs_error_rate_notice":{},"learn_more":"per a saber-ne més...","all_time":"total","all_time_desc":"total de temes creats","year":"any","year_desc":"temes creats durant els darrers 365 dies","month":"mes","month_desc":"temes creats durant els darrers 30 dies","week":"setmana","week_desc":"temes creats durant els darrers 7 dies","day":"dia","first_post":"Primera publicació","mute":"Silencia","unmute":"Desfés el silenciament","last_post":"Publicat","time_read":"Llegit","time_read_recently":"%{time_read} recentment","time_read_tooltip":"%{time_read} temps total de lectura","time_read_recently_tooltip":"%{time_read} temps total de lectura (%{recent_time_read} en els darrers 60 dies)","last_reply_lowercase":"darrera resposta","replies_lowercase":{"one":"resposta","other":"respostes"},"signup_cta":{"sign_up":"Registre","hide_session":"Recorda-m'ho demà","hide_forever":"no, gràcies","hidden_for_session":"D'acord, us ho demanarem demà. Sempre podeu fer servir també \u003ci\u003eInicia la sessió\u003c/i\u003e per a crear un compte.","intro":"Bon dia! Sembla que gaudiu de la discussió, però no heu registrat un compte.","value_prop":"Quan creeu un compte, recordem exactament el que heu llegit, de manera que sempre torneu allà on ho vau deixar. També rebreu notificacions, ací i via correu, quan algú us respon. I podeu dir que us agraden les publicacions per a compartir l'amor. :heartpulse:"},"summary":{"enabled_description":"Ara veieu un resum del tema: les publicacions més interessants segons la comunitat.","description":"Hi ha \u003cb\u003e{{replyCount}}\u003c/b\u003e respostes.","description_time":"Hi ha \u003cb\u003e{{replyCount}}\u003c/b\u003e respostes amb un temps de lectura estimat de \u003cb\u003e{{readingTime}} minuts\u003c/b\u003e.","enable":"Resumeix aquest tema","disable":"Mostra totes les publicacions"},"deleted_filter":{"enabled_description":"Aquest tema conté publicacions suprimides, que han estat amagades.","disabled_description":"Es mostren les publicacions suprimides en el tema.","enable":"Amaga publicacions suprimides","disable":"Mostra publicacions suprimides"},"private_message_info":{"title":"Missatge","invite":"Convideu altres persones...","edit":"Afegeix o elimina...","leave_message":"Realment voleu deixar aquest missatge?","remove_allowed_user":"De debò voleu eliminar {{name}} d'aquest missatge?","remove_allowed_group":"De debò voleu eliminar {{name}} d'aquest missatge?"},"email":"Correu electrònic","username":"Nom d'usuari","last_seen":"Vist","created":"Creat","created_lowercase":"creat","trust_level":"Nivell de confiança","search_hint":"nom d'usuari, adreça electrònica o adreça IP","create_account":{"disclaimer":"Registrant-vos, accepteu la \u003ca href='{{privacy_link}}' target='blank'\u003epolítica de privacitat\u003c/a\u003e i les \u003ca href='{{tos_link}}' target='blank'\u003econdicions del servei\u003c/a\u003e.","title":"Crea un compte nou","failed":"Alguna cosa ha anat malament. Potser aquest correu electrònic ja ha estat registrat; proveu-ho amb l'enllaç de contrasenya oblidada"},"forgot_password":{"title":"Restabliment de contrasenya","action":"He oblidat la contrasenya","invite":"Introduïu el nom d'usuari o l'adreça de correu, i us enviarem un correu per a restablir la contrasenya.","reset":"Restableix la contrasenya","complete_username":"Si hi ha algun compte que correspongui a l'usuari \u003cb\u003e%{username}\u003c/b\u003e, hauríeu de rebre aviat un correu amb instruccions per a restablir la contrasenya.","complete_email":"Si hi ha algun compte que correspon a l'adreça \u003cb\u003e%{email}\u003c/b\u003e, hauríeu de rebre aviat un correu amb instruccions per a restablir la contrasenya.","complete_username_found":"Hem trobat un compte que correspon al nom d'usuari \u003cb\u003e%{username}\u003c/b\u003e. Hauríeu de rebre un correu amb instruccions per a restablir la contrasenya.","complete_email_found":"Hem trobat un compte que correspon a l'adreça \u003cb\u003e%{email}\u003c/b\u003e. Hauríeu de rebre aviat un correu amb instruccions per a restablir la contrasenya.","complete_username_not_found":"No hi ha cap compte que coincideixi amb el nom d'usuari \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Cap compte no coincideix amb \u003cb\u003e%{email}\u003c/b\u003e","help":"No arriba el correu? Comproveu primer la carpeta de correu brossa. \u003cp\u003eNo esteu segur de quina adreça heu fet servir? Introduïu una adreça i us farem saber si existeix.\u003c/p\u003e \u003cp\u003eSi ja no teniu accés a l'adreça del vostre compte, poseu-vos en contacte amb \u003ca href='%{basePath}/about'\u003eel nostre equip responsable\u003c/a\u003e\u003c/p\u003e.","button_ok":"D'acord","button_help":"Ajuda"},"email_login":{"link_label":"Envia'm per correu un enllaç per a iniciar sessió","button_label":"amb correu electrònic","complete_username":"Si hi ha un compte amb el nom d'usuari \u003cb\u003e%{username}\u003c/b\u003e, aviat rebreu un correu amb un enllaç per a iniciar sessió.","complete_email":"Si hi ha un compte que coincideix amb \u003cb\u003e%{email}\u003c/b\u003e, aviat rebreu un correu amb un enllaç per a iniciar sessió. ","complete_username_found":"S'ha trobat un compte que coincideix amb el nom d'usuari \u003cb\u003e%{username}\u003c/b\u003e. Aviat rebreu un correu amb un enllaç per a iniciar sessió.","complete_email_found":"S'ha trobat un compte que coincideix amb \u003cb\u003e%{email}\u003c/b\u003e. Aviat rebreu un correu amb un enllaç per a iniciar sessió.","complete_username_not_found":"No hi ha cap compte que coincideixi amb el nom d'usuari \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Cap compte no coincideix amb \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Continua a %{site_name}","logging_in_as":"Iniciant sessió com a %{email}","confirm_button":"Acaba l'inici de sessió"},"login":{"title":"Inicia la sessió","username":"Usuari","password":"Contrasenya","second_factor_title":"Autenticació de dos factors","second_factor_description":"Introduïu el codi d'autenticació de la vostra aplicació:","second_factor_backup":"Inici de sessió amb codi de còpia de seguretat ","second_factor_backup_title":"Còpia de seguretat de dos factors","second_factor_backup_description":"Introduïu un dels vostres codis de còpia de seguretat:","second_factor":"Inici de sessió amb l’aplicació Authenticator","security_key_description":"Quan tingueu preparada la vostra clau de seguretat física, premeu el botó Autentica amb clau de seguretat.","security_key_alternative":"Proveu d’una altra manera","security_key_authenticate":"Autenticació amb clau de seguretat","security_key_not_allowed_error":"El procés d'autenticació de claus de seguretat ha arribat al límit de temps o s'ha cancel·lat. ","security_key_no_matching_credential_error":"No s'ha trobat cap credencial coincident amb la clau de seguretat proporcionada.","security_key_support_missing_error":"El vostre dispositiu o navegador actual no admet l'ús de claus de seguretat. Utilitzeu un mètode diferent.","email_placeholder":"correu electrònic o nom d'usuari","caps_lock_warning":"El bloqueig de majúscula és activat","error":"Error desconegut","cookies_error":"Sembla que el vostre navegador té les galetes desactivades. És possible que no pugueu iniciar sessió sense activar-les primer.","rate_limit":"Espereu una mica abans de tornar a iniciar la sessió.","blank_username":"Introduïu l'adreça de correu o el nom d'usuari.","blank_username_or_password":"Introduïu el correu electrònic o el nom d'usuari i la contrasenya.","reset_password":"Restableix la contrasenya","logging_in":"Iniciant la sessió...","or":"O","authenticating":"Autenticant...","awaiting_activation":"El vostre compte espera l'activació. Utilitzeu l'enllaç de contrasenya oblidada per a tramitar un altre correu d'activació.","awaiting_approval":"El vostre compte encara no ha estat aprovat per l'equip responsable. Us enviarem un correu quan sigui aprovat.","requires_invite":"L'accés a aquest fòrum es fa sols amb invitació.","not_activated":"Encara no podeu iniciar sessió. Abans us hem enviat un correu d'activació a \u003cb\u003e{{sentTo}}\u003c/b\u003e. Seguiu les instruccions del correu per a activar el compte.","not_allowed_from_ip_address":"No podeu iniciar la sessió des d'aquesta adreça IP.","admin_not_allowed_from_ip_address":"No podeu iniciar la sessió com a administrador des d'aquesta adreça IP.","resend_activation_email":"Feu clic aquí per a enviar de nou el correu d'activació.","omniauth_disallow_totp":"El vostre compte té habilitada l'autenticació de dos factors. Inicieu sessió amb la contrasenya.","resend_title":"Reenvia el correu d'activació","change_email":"Canvi d'adreça de correu","provide_new_email":"Proporcioneu una adreça nova i us reenviarem el correu de confirmació.","submit_new_email":"Actualitza l'adreça de correu","sent_activation_email_again":"Us hem enviat un altre correu d'activació a \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Potser triga a arribar uns pocs minuts; assegureu-vos de comprovar la carpeta de correu brossa.","sent_activation_email_again_generic":"S'ha enviat un altre correu d'activació. Pot trigar uns quants minuts a arribar; comproveu la carpeta de correu brossa.","to_continue":"Inicieu la sessió","preferences":"Cal que inicieu la sessió per a canviar les preferències d'usuari.","forgot":"No recordo els detalls del meu compte","not_approved":"El vostre compte encara no ha estat aprovat. Us notificarem per correu quan tingueu permís per a iniciar sessió.","google_oauth2":{"name":"Google","title":"amb Google"},"twitter":{"name":"Twitter","title":"amb Twitter"},"instagram":{"name":"Instagram","title":"amb Instagram"},"facebook":{"name":"Facebook","title":"amb Facebook"},"github":{"name":"GitHub","title":"amb GitHub"},"discord":{"name":"Discord","title":"amb Discord"},"second_factor_toggle":{"totp":"Utilitzeu una aplicació d'autenticació en comptes d'això","backup_code":"Utilitzeu un codi de còpia de seguretat en comptes d'això"}},"invites":{"accept_title":"Invitació","welcome_to":"Benvingut a %{site_name}!","invited_by":"Heu estat convidat per:","social_login_available":"També podreu iniciar sessió amb qualsevol plataforma social que faci servir aquesta adreça.","your_email":"L'adreça de correu del vostre compte és \u003cb\u003e%{email}\u003c/b\u003e","accept_invite":"Accepta la invitació","success":"S'ha creat el compte i ara heu iniciat la sessió.","name_label":"Nom","password_label":"Estableix la contrasenya","optional_description":"(opcional)"},"password_reset":{"continue":"Continua a %{site_name}"},"emoji_set":{"apple_international":"Apple/Internacional","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (abans EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Només categories","categories_with_featured_topics":"Categories amb temes destacats","categories_and_latest_topics":"Categories i temes més recents","categories_and_top_topics":"Categories i temes principals","categories_boxes":"Caixes amb subcategories","categories_boxes_with_topics":"Caixes amb temes destacats"},"shortcut_modifier_key":{"shift":"Maj","ctrl":"Ctrl","alt":"Alt","enter":"Retorn"},"conditional_loading_section":{"loading":"Carregant..."},"category_row":{"topic_count":"{{count}}temes en aquesta categoria"},"select_kit":{"default_header_text":"Selecciona...","no_content":"No s'han trobat coincidències","filter_placeholder":"Cerca...","filter_placeholder_with_any":"Cerca o crea...","create":"Crea: '{{content}}'","max_content_reached":{"one":"Sols podeu seleccionar {{count}} element.","other":"Sols podeu seleccionar {{count}} elements."},"min_content_not_reached":{"one":"Selecciona almenys {{count}} element.","other":"Seleccioneu almenys {{count}}elements."}},"date_time_picker":{"from":"De","to":"A","errors":{"to_before_from":"La data final ha de ser posterior a la data inicial."}},"emoji_picker":{"filter_placeholder":"Cerca un emoji","smileys_\u0026_emotion":"Emoticones","people_\u0026_body":"Gent i cos","animals_\u0026_nature":"Animals i natura","food_\u0026_drink":"Menjar i beure","travel_\u0026_places":"Viatges i llocs","activities":"Activitats","objects":"Objectes","symbols":"Símbols","flags":"Banderes","recent":"Usats recentment","default_tone":"Sense to de pell","light_tone":"To de pell clar","medium_light_tone":"To de pell clar mitjà","medium_tone":"To de pell mitjà","medium_dark_tone":"To de pell fosc mitjà","dark_tone":"To de pell fosc","default":"Emojis personalitzats"},"shared_drafts":{"title":"Esborranys compartits","notice":"Aquest tema sols és visible per als qui poden veure la categoria \u003cb\u003e{{category}}\u003c/b\u003e.","destination_category":"Categoria de destinació","publish":"Publica l'esborrany compartit","confirm_publish":"Esteu segur que voleu publicar aquest esborrany?","publishing":"Publicant el tema..."},"composer":{"emoji":"Emoji :)","more_emoji":"més...","options":"Opcions","whisper":"xiuxiueig","unlist":"invisible","blockquote_text":"Bloc de citació","add_warning":"Aquest és un avís oficial.","toggle_whisper":"Commuta el xiuxiueig","toggle_unlisted":"Commuta invisible","posting_not_on_topic":"A quin tema voleu respondre?","saved_local_draft_tip":"desat localment","similar_topics":"El tema és semblant a...","drafts_offline":"esborranys fora de línia","edit_conflict":"edita el conflicte","group_mentioned_limit":"\u003cb\u003eAtenció!\u003c/b\u003e Heu mencionat \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, però aquest grup té més membres que el límit de mencions configurat per l'administrador: {{max}} usuaris. No serà notificat ningú. ","group_mentioned":{"one":"Si mencioneu {{group}}, ho notificareu a \u003ca href='{{group_link}}'\u003e%{count}persona\u003c/a\u003e. Esteu segur?","other":"Si mencioneu {{group}}, ho notificareu a \u003ca href='{{group_link}}'\u003e{{count}} persones\u003c/a\u003e. Esteu segur?"},"cannot_see_mention":{"category":"Heu mencionat {{username}}, però no se li notificarà res perquè aquesta persona no gaudeix d'accés a aquesta categoria. Us caldrà afegir-la a un grup que tingui accés a aquesta categoria.","private":"Heu mencionat {{username}}, però no es notificarà res perquè aquest usuari no pot veure aquest missatge personal. Haureu de convidar-lo al MP."},"duplicate_link":"Sembla que l'enllaç a \u003cb\u003e{{domain}}\u003c/b\u003e ja havia estat publicat en el tema per \u003cb\u003e@{{username}}\u003c/b\u003e en \u003ca href='{{post_url}}'\u003euna resposta {{ago}}\u003c/a\u003e. Esteu segur que voleu publicar-lo una altra vegada?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"El títol és obligatori","title_too_short":"El títol ha de tenir un mínim de {{min}} caràcters","title_too_long":"El títol ha de tenir un màxim de {{max}} caràcters","post_missing":"La publicació no pot estar buida","post_length":"La publicació ha de tenir un mínim de {{min}} caràcters","try_like":"Heu provat el botó {{heart}}?","category_missing":"Heu de triar una categoria","tags_missing":"Cal triar almenys {{count}} etiquetes.","topic_template_not_modified":"Afegiu detalls i especificacions al tema editant la plantilla."},"save_edit":"Desa l'edició","overwrite_edit":"Sobreescriu l'edició","reply_original":"Respon en el tema original","reply_here":"Respon aquí","reply":"Respon","cancel":"Cancel·la","create_topic":"Crea un tema","create_pm":"Missatge","create_whisper":"Xiuxiueig","create_shared_draft":"Crea un esborrany compartit","edit_shared_draft":"Edita l'esborrany compartit","title":"O prem Ctrl+Retorn","users_placeholder":"Afegeix un usuari","title_placeholder":"De què tracta aquesta discussió (en una frase curta)?","title_or_link_placeholder":"Escriviu aquí el títol o enganxeu-hi un enllaç","edit_reason_placeholder":"per què ho editeu?","topic_featured_link_placeholder":"Introduïu un enllaç mostrat amb títol.","remove_featured_link":"Elimina l'enllaç del tema.","reply_placeholder":"Escriviu aquí. Feu servir Markdown, BBCode o HTML per a donar format. Arrossegueu o enganxeu imatges.","reply_placeholder_no_images":"Escriviu aquí. Feu servir Markdown, BBCode o HTML per a donar format.","reply_placeholder_choose_category":"Seleccioneu una categoria abans d'escriure aquí.","view_new_post":"Mostra la nova publicació.","saving":"Desant","saved":"Desat!","saved_draft":"Publica l'esborrany en curs. Toqueu per a continuar.","uploading":"Carregant...","show_preview":"mostra la previsualització \u0026raquo; ","hide_preview":"\u0026laquo; amaga la previsualització","quote_post_title":"Cita tota la publicació","bold_label":"B","bold_title":"Negreta","bold_text":"text en negreta","italic_label":"I","italic_title":"Cursiva","italic_text":"text en cursiva","link_title":"Enllaç","link_description":"introduïu una descripció de l'enllaç","link_dialog_title":"Insereix un enllaç","link_optional_text":"títol opcional","link_url_placeholder":"Enganxeu un URL o escriviu per a cercar temes","quote_title":"Bloc de citació","quote_text":"Bloc de citació","code_title":"Text preformatat","code_text":"Text amb sagnat preformatat de 4 espais","paste_code_text":"escriviu o enganxeu el codi aquí","upload_title":"Carrega","upload_description":"escriviu aquí una descripció del fitxer que es carrega","olist_title":"Llista numerada","ulist_title":"Llista de pics","list_item":"Element de llista","toggle_direction":"Commuta la direcció","help":"Ajuda d'edició Markdown","collapse":"minimitza el tauler de redacció","open":"obre el tauler de redacció","abandon":"tanca la redacció i rebutja l'esborrany","enter_fullscreen":"entra en la redacció a pantalla completa","exit_fullscreen":"surt de la redacció a pantalla completa","modal_ok":"D'acord","modal_cancel":"Cancel·la","cant_send_pm":"No podeu enviar cap missatge a %{username}.","yourself_confirm":{"title":"Heu oblidat afegir destinataris?","body":"Ara mateix aquest missatge només s'està enviant a la vostra bústia!"},"admin_options_title":"Configuració opcional de l'equip responsable per a aquest tema","composer_actions":{"reply":"Respon","draft":"Esborrany","edit":"Edita","reply_to_post":{"label":"Respon a la publicació %{postNumber} de %{postUsername}","desc":"Respon a una publicació específica"},"reply_as_new_topic":{"label":"Respon com a tema enllaçat","desc":"Crea un tema nou enllaçat a aquest tema"},"reply_as_private_message":{"label":"Missatge nou","desc":"Crea un missatge personal nou "},"reply_to_topic":{"label":"Respon al tema","desc":"Respon al tema, no a cap publicació específica"},"toggle_whisper":{"label":"Commuta xiuxiueig","desc":"Els xiuxiuejos sols són visibles a membres de l'equip responsable"},"create_topic":{"label":"Tema nou"},"shared_draft":{"label":"Esborrany compartit","desc":"Esborrany d'un tema que sols serà visible a l'equip responsable"},"toggle_topic_bump":{"label":"Commuta l'elevació del tema","desc":"Respon sense canviar la data més recent de resposta"}},"details_title":"Resum","details_text":"Aquest text serà amagat"},"notifications":{"tooltip":{"regular":{"one":"%{count} notificació no vista","other":"{{count}} notificacions no vistes"},"message":{"one":"%{count} missatge no llegit","other":"{{count}}missatges no llegits"}},"title":"notificacions de mencions via @nom, respostes a les vostres  publicacions i temes, missatges, etc.","none":"És impossible carregar ara mateix les notificacions","empty":"No hi ha notificacions.","post_approved":"La vostra publicació ha estat aprovada","reviewable_items":"elements que requereixen revisió","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} i %{count} altre\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} i {{count}} altres\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"li agrada {{count}} de les vostres publicacions","other":" {{count}} de les vostres publicacions té 'M'agrada'"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e ha acceptat la vostra invitació","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e ha mogut {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Heu guanyat '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eTema nou\u003c/span\u003e {{description}}","membership_request_accepted":"Membre acceptat en '{{group_name}}'","group_message_summary":{"one":"{{count}} missatge en la vostra bústia de {{group_name}}","other":"{{count}} missatges en la vostra bústia de {{group_name}}"},"popup":{"mentioned":"{{username}} us ha mencionat en \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} us ha mencionat en \"{{topic}}\" - {{site_title}}","quoted":"{{username}} us ha citat en \"{{topic}}\" - {{site_title}}","replied":"{{username}} us ha respost en \"{{topic}}\" - {{site_title}}","posted":"{{username}} publicat en \"{{topic}}\" - {{site_title}}","private_message":"{{username}} us ha enviat un missatge personal en \"{{topic}}\" - {{site_title}}","linked":"{{username}} ha enllaçat la vostra publicació en \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} ha creat un tema nou \"{{topic}}\" - {{site_title}}","confirm_title":"Notificacions activades - %{site_title}","confirm_body":"Èxit! S'han habilitat les notificacions.","custom":"Notificació de {{username}} sobre %{site_title}"},"titles":{"mentioned":"mencionat","replied":"resposta nova","quoted":"citat","edited":"editat","liked":"nou 'm'agrada'","private_message":"nou missatge privat","invited_to_private_message":"convidat a missatge privat","invitee_accepted":"invitació acceptada","posted":"publicació nova","moved_post":"publicació moguda","linked":"enllaçat","granted_badge":"insígnia concedida","invited_to_topic":"convidat al tema","group_mentioned":"grup mencionat","group_message_summary":"nous missatges de grup","watching_first_post":"tema nou","topic_reminder":"recordatori de tema","liked_consolidated":"nous 'm'agrada'","post_approved":"publicació aprovada"}},"upload_selector":{"title":"Afegeix una imatge","title_with_attachments":"Afegeix una imatge o un fitxer","from_my_computer":"Des del meu dispositiu","from_the_web":"Des de la web","remote_tip":"enllaç a imatge","remote_tip_with_attachments":"enllaç a imatge o fixer {{authorized_extensions}} ","local_tip":"seleccioneu imatges des del vostre dispositiu","local_tip_with_attachments":"trieu imatges o fitxers des del vostre dispositiu {{authorized_extensions}}","hint":"(per a carregar-los, també podeu arrossegar-los i deixar-los anar en l'editor)","hint_for_supported_browsers":"també podeu arrossegar i deixar anar o enganxar imatges en l'editor","uploading":"Carregant","select_file":"Tria un fitxer","default_image_alt_text":"imatge"},"search":{"sort_by":"Ordena per","relevance":"Importància","latest_post":"Publicacions més recents","latest_topic":"Temes més recents","most_viewed":"Més vists","most_liked":"Ha tingut més 'm'agrada'","select_all":"Selecciona-ho tot","clear_all":"Neteja-ho tot","too_short":"El terme de la vostra cerca és massa curt","result_count":{"one":"\u003cspan\u003e%{count} resultat per a \u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} resultats per a\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"cerca temes, publicacions, usuaris o categories","full_page_title":"cerca temes o publicacions","no_results":"No hi ha resultats.","no_more_results":"No s'han trobat més resultats.","searching":"Cercant...","post_format":"#{{post_number}} per {{username}}","results_page":"Resultats de la cerca per a '{{term}}'","more_results":"No hi ha més resultats. Restringiu els criteris de cerca.","cant_find":"No podeu trobar el que busqueu?","start_new_topic":"Podeu començar un tema nou.","or_search_google":"O proveu de cercar amb Google:","search_google":"Prova de cercar amb Google:","search_google_button":"Google","search_google_title":"Cerca en aquest lloc web","context":{"user":"Cerca publicacions de @{{username}}","category":"Cerca en la categoria #{{category}} ","tag":"Cerca l'etiqueta #{{tag}}","topic":"Cerca en aquest tema","private_messages":"Cerca missatges"},"advanced":{"title":"Cerca avançada","posted_by":{"label":"Publicat per"},"in_category":{"label":"Categoritzats"},"in_group":{"label":"En el grup"},"with_badge":{"label":"Amb insígnia"},"with_tags":{"label":"Etiquetats"},"filters":{"label":"Sols temes/publicacions existents...","title":"Coincidència sols en el títol","likes":"M'han agradat","posted":"He publicat en","watching":"Estic vigilant","tracking":"Estic seguint","private":"En els meus missatges","bookmarks":"He marcat com a preferits","first":"són la primera publicació","pinned":"estan afixats","unpinned":"no estan afixats","seen":"he llegit","unseen":"no he llegit","wiki":"són wiki","images":"inclou imatge(s)","all_tags":"Totes les etiquetes anteriors"},"statuses":{"label":"On els temes","open":"són oberts","closed":"són tancats","archived":"estan arxivats","noreplies":"tenen zero respostes","single_user":"contenen un únic usuari"},"post":{"count":{"label":"Recompte mínim de publicacions"},"time":{"label":"Publicat","before":"abans de","after":"després de"}}}},"hamburger_menu":"vés a una altra llista de temes o categories","new_item":"nous","go_back":"vés enrere","not_logged_in_user":"pàgina d'usuari amb resum de l'activitat actual i preferències ","current_user":"vés a la meva pàgina d'usuari","view_all":"mostra-ho tot","topics":{"new_messages_marker":"darrera visita","bulk":{"select_all":"Selecciona-ho tot","clear_all":"Neteja-ho tot","unlist_topics":"Fes temes invisibles","relist_topics":"Torna a llistar els temes","reset_read":"Restableix llegit","delete":"Suprimeix temes","dismiss":"Descarta-ho","dismiss_read":"Descarta tots els llegits","dismiss_button":"Descarta-ho...","dismiss_tooltip":"Descarta només les noves publicacions o atura el seguiment de temes","also_dismiss_topics":"Deixa de seguir aquests temes i que no m'apareguin mai més com a no llegits.","dismiss_new":"Descarta'n els nous","toggle":"commuta la selecció massiva de temes","actions":"Accions massives","change_category":"Defineix categoria","close_topics":"Tanca temes","archive_topics":"Arxiva temes","notification_level":"Notificacions","choose_new_category":"Seleccioneu la categoria nova per als temes:","selected":{"one":"He seleccionat \u003cb\u003e%{count}\u003c/b\u003e tema.","other":"Heu seleccionat \u003cb\u003e{{count}}\u003c/b\u003e temes."},"change_tags":"Reemplaça etiquetes","append_tags":"Annexa etiquetes","choose_new_tags":"Trieu noves etiquetes per a aquests temes:","choose_append_tags":"Trieu noves etiquetes a afegir per a aquests temes:","changed_tags":"Les etiquetes d'aquests temes han estat canviades."},"none":{"unread":"No teniu cap tema no llegit.","new":"No teniu cap tema nou.","read":"Encara no heu llegit cap tema.","posted":"Encara no heu publicat cap tema.","latest":"No hi ha temes més recents. És una llàstima.","bookmarks":"Encara no heu marcat temes com a preferits.","category":"No hi ha temes de {{category}}.","top":"No hi ha temes principals.","educate":{"new":"\u003cp\u003eEls vostres temes nous són aquí.\u003c/p\u003e\u003cp\u003ePer defecte, els temes es consideren nous i mostraran una \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enova\u003c/span\u003e indicació si han estat creats durant els passats 2 dies.\u003c/p\u003e\u003cp\u003eAneu a les vostres \u003ca href=\"%{userPrefsUrl}\"\u003epreferències\u003c/a\u003e per a canviar-ho.\u003c/p\u003e","unread":"\u003cp\u003eEls vostres temes nous són aquí.\u003c/p\u003e\u003cp\u003ePer defecte, els temes es consideren sense llegir i mostraran recomptes de no llegits \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e si:\u003c/p\u003e\u003cul\u003e\u003cli\u003eheu creat el tema\u003c/li\u003e\u003cli\u003eheu respost al tema\u003c/li\u003e\u003cli\u003eheu llegit el tema durant més de 4 minuts\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eo si heu marcat explícitament el tema com a vigilat amb el control de notificació a baix de cada tema.\u003c/p\u003e\u003cp\u003eVisiteu les vostres \u003ca href=\"%{userPrefsUrl}\"\u003epreferències\u003c/a\u003e per a canviar-ho.\u003c/p\u003e"}},"bottom":{"latest":"No hi ha més temes recents.","posted":"No hi ha més temes publicats.","read":"No hi ha més temes llegits.","new":"No hi ha més temes nous.","unread":"No hi ha més temes no llegits. ","category":"No hi ha més temes de {{category}}.","top":"No hi ha més temes destacats.","bookmarks":"No hi ha més temes marcats com a preferits."}},"topic":{"filter_to":{"one":"%{count} publicació en el tema","other":"{{count}} publicacions en el tema"},"create":"Tema nou","create_long":"Crea un tema nou","open_draft":"Obre esborrany","private_message":"Comença un missatge","archive_message":{"help":"Mou el missatge al meu arxiu","title":"Arxiva"},"move_to_inbox":{"title":"Mou a la safata d'entrada","help":"Torna el missatge a la safata d'entrada"},"edit_message":{"help":"Edita la primera publicació del missatge","title":"Edita el missatge"},"defer":{"help":"Marca com a no llegit","title":"Ajorna"},"list":"Temes","new":"tema nou","unread":"no llegit","new_topics":{"one":"%{count} tema nou","other":"{{count}} temes nous "},"unread_topics":{"one":"%{count} tema no llegit","other":"{{count}} temes no llegits"},"title":"Tema","invalid_access":{"title":"El tema és privat","description":"No teniu accés al tema!","login_required":"Heu d'iniciar sessió per a veure aquest tema."},"server_error":{"title":"La càrrega del tema ha fallat","description":"No hem pogut carregar aquest tema, possiblement a causa d'un problema de connexió. Torneu a provar-ho, i si el problema continua, feu-nos-ho saber."},"not_found":{"title":"Tema no trobat","description":"No hem pogut trobar aquest tema. Potser ha estat eliminat per un moderador."},"total_unread_posts":{"one":"teniu %{count} missatge no llegit en aquest tema","other":"teniu {{count}} missatges no llegits en aquest tema"},"unread_posts":{"one":"teniu %{count} publicació antiga no llegida en aquest tema","other":"teniu {{count}} publicacions antigues no llegides en aquest tema"},"new_posts":{"one":"hi ha %{count} publicació nova en aquest tema des de la vostra darrera lectura","other":"hi ha {{count}} publicacions noves en aquest tema des de la vostra darrera lectura"},"likes":{"one":"hi ha %{count} 'M'agrada' en aquest tema","other":"hi ha {{count}} 'M'agrada' en aquest tema"},"back_to_list":"Torna a la llista de temes","options":"Opcions del tema","show_links":"mostra enllaços dins d'aquest tema","toggle_information":"commuta els detalls del tema","read_more_in_category":"Voleu llegir-ne més? Navegueu per altres temes a {{catLink}} o {{latestLink}}.","read_more":"Voleu llegir-ne més? {{catLink}} o {{latestLink}}.","group_request":"Cal que sol·liciteu pertànyer al grup `{{name}}` per a veure aquest tema","group_join":"Cal que us uniu al grup `{{name}}` per a veure aquest tema","group_request_sent":"S'ha enviat la vostra sol·licitud d'afiliació al grup. Sereu informat quan sigui acceptada.","unread_indicator":"Cap membre encara no ha llegit la darrera publicació d'aquest tema.","browse_all_categories":"Navega per totes les categories","view_latest_topics":"mira els temes més recents","suggest_create_topic":"Per què no creeu un tema?","jump_reply_up":"salta a la resposta anterior","jump_reply_down":"salta a la resposta posterior","deleted":"El tema ha estat suprimit","topic_status_update":{"title":"Temporitzador de tema","save":"Estableix el temporitzador","num_of_hours":"Nombre d'hores:","remove":"Elimina el temporitzador","publish_to":"Publica en:","when":"Quan:","public_timer_types":"Temporitzadors de temes","private_timer_types":"Temporitzadors de temes d'usuari","time_frame_required":"Seleccioneu un període de temps"},"auto_update_input":{"none":"Seleccioneu un període de temps","later_today":"Més tard avui","tomorrow":"Demà","later_this_week":"Més avant aquesta setmana","this_weekend":"Aquest cap de setmana","next_week":"La setmana que ve","two_weeks":"Dues setmanes","next_month":"El mes que ve","two_months":"Dos mesos","three_months":"Tres mesos","four_months":"Quatre mesos","six_months":"Sis mesos","one_year":"Un any","forever":"Sempre","pick_date_and_time":"Trieu data i hora","set_based_on_last_post":"Tanca d'acord amb la darrera publicació"},"publish_to_category":{"title":"Programa la publicació"},"temp_open":{"title":"Obre temporalment"},"auto_reopen":{"title":"Obre automàticament el tema"},"temp_close":{"title":"Tanca temporalment"},"auto_close":{"title":"Tanca el tema automàticament","label":"Hores per al tancament automàtic del tema:","error":"Introduïu un valor vàlid.","based_on_last_post":"No el tanquis fins que la darrera publicació del tema tingui almenys aquesta edat."},"auto_delete":{"title":"Suprimeix automàticament el tema"},"auto_bump":{"title":"Eleva automàticament el tema"},"reminder":{"title":"Recorda-m'ho"},"status_update_notice":{"auto_open":"Aquest tema s'obrirà automàticament %{timeLeft}","auto_close":"El tema es tancarà automàticament %{timeLeft}.","auto_publish_to_category":"Aquest tema serà publicat en \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e%{timeLeft}","auto_close_based_on_last_post":"Aquest tema es tancarà %{duration} després de la darrera resposta.","auto_delete":"Aquest tema serà suprimit automàticament %{timeLeft}","auto_bump":"Aquest tema serà elevat automàticament %{timeLeft}.","auto_reminder":"Rebreu un recordatori sobre aquest tema %{timeLeft}"},"auto_close_title":"Configuració del tancament automàtic","auto_close_immediate":{"one":"La darrera publicació en el tema ja té %{count} hora, per això el tema es tancarà immediatament.","other":"La darrera publicació en el tema ja té %{count} hores, per això el tema es tancarà immediatament."},"timeline":{"back":"Enrere","back_description":"Vés a la darrera publicació no llegida","replies_short":"%{current} / %{total}"},"progress":{"title":"progrés del tema","go_top":"a dalt","go_bottom":"a baix","go":"vés","jump_bottom":"salta a la darrera publicació","jump_prompt":"salta a...","jump_prompt_of":"de %{count} publicacions","jump_prompt_long":"Salta a...","jump_bottom_with_number":"salta a la publicació %{post_number}","jump_prompt_to_date":"fins a la data","jump_prompt_or":"o","total":"total de publicacions","current":"publicació actual"},"notifications":{"title":"canvieu la freqüència d'alertes que rebeu sobre aquest tema","reasons":{"mailing_list_mode":"Teniu activat el mode de llista de correu, així us notificarem les respostes a aquest tema per correu electrònic.","3_10":"Rebreu notificacions perquè vigileu una etiqueta sobre aquest tema.","3_6":"Rebreu notificacions perquè vigileu aquesta categoria. ","3_5":"Rebreu notificacions perquè heu començat a vigilar aquest tema automàticament. ","3_2":"Rebreu notificacions perquè vigileu aquest tema. ","3_1":"Rebreu notificacions perquè heu creat aquest tema.","3":"Rebreu notificacions perquè vigileu aquest tema.","2_8":"Veureu un recompte de respostes perquè seguiu aquesta categoria. ","2_4":"Rebreu notificacions perquè heu escrit una resposta a aquest tema.","2_2":"Rebreu notificacions perquè seguiu aquest tema.","2":"Rebreu notificacions perquè heu \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003ellegit aquest tema\u003c/a\u003e.","1_2":"Sereu notificat si algú menciona el vostre @nom o us respon.","1":"Sereu notificat si algú us @menciona o us respon.","0_7":"No esteu fent cas de les notificacions d'aquesta categoria.","0_2":"No esteu fent cas de les notificacions d'aquest tema.","0":"No esteu fent cas de les notificacions sobre aquest tema."},"watching_pm":{"title":"Vigilant","description":"Us notificarem cada resposta nova a aquest missatge i us mostrarem un nou recompte de respostes."},"watching":{"title":"Vigilant","description":"Us notificarem cada resposta nova a aquest tema i us mostrarem un nou recompte de respostes."},"tracking_pm":{"title":"Seguint","description":"Se us mostrarà un recompte de respostes noves a aquest missatge. Sereu notificat si algú us @menciona o us respon."},"tracking":{"title":"Seguint","description":"Se us mostrarà un recompte de respostes noves a aquest tema. Sereu notificat si algú us @menciona o us respon."},"regular":{"title":"Normal","description":"Sereu notificat si algú menciona el vostre @nom o us respon."},"regular_pm":{"title":"Normal","description":"Sereu notificat si algú us @menciona o us respon."},"muted_pm":{"title":"Silenciat","description":"Mai no us notificarem res sobre aquest missatge."},"muted":{"title":"Silenciat","description":"No us notificarem res sobre aquest tema i no apareixerà en els més recents."}},"actions":{"title":"Accions","recover":"Desfés la supressió del tema","delete":"Suprimeix tema","open":"Obre tema","close":"Tanca tema","multi_select":"Tria publicacions...","timed_update":"Estableix el temporitzador del tema...","pin":"Afixa tema","unpin":"Desafixa el tema","unarchive":"Desarxiva tema","archive":"Arxiva tema","invisible":"Fes invisible","visible":"Fes visible","reset_read":"Restableix data de lectura","make_public":"Fes públic el tema","make_private":"Converteix en missatge personal","reset_bump_date":"Restableix la data d'elevació"},"feature":{"pin":"Afixa tema","unpin":"Desafixa tema","pin_globally":"Afixa tema globalment","make_banner":"Converteix tema en bàner","remove_banner":"Elimina el bàner de tema"},"reply":{"title":"Respon","help":"comença a redactar una resposta al tema"},"clear_pin":{"title":"Neteja afixat","help":"Neteja l'estat afixat del tema perquè no torni a aparèixer al principi de la vostra llista de temes"},"share":{"title":"Comparteix","extended_title":"Comparteix un enllaç","help":"comparteix un enllaç a aquest tema"},"print":{"title":"Imprimeix","help":"Obre una versió imprimible d'aquest tema"},"flag_topic":{"title":"Bandera","help":"posa bandera en privat a aquest tema per a parar-hi atenció o envia'n una notificació privada","success_message":"Heu posat amb èxit la bandera a aquest tema."},"make_public":{"title":"Converteix en tema públic","choose_category":"Trieu una categoria per al tema públic:"},"feature_topic":{"title":"Destaca aquest tema","pin":"Fes que aquest tema aparegui al principi de la categoria {{categoryLink}} fins a","confirm_pin":"Ja teniu {{count}} temes afixats. Massa temes afixats poden ser pesats per a usuaris nous o anònims. Esteu segur que voleu afixar un altre tema en aquesta categoria?","unpin":"Elimina aquest tema del principi de la categoria {{categoryLink}}.","unpin_until":"Elimina aquest tema del principi de la categoria {{categoryLink}} o espera fins a \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Els mateixos usuaris poden desafixar el tema individualment.","pin_validation":"Cal una data per a afixar aquest tema.","not_pinned":"No hi ha temes afixats en {{categoryLink}}.","already_pinned":{"one":"Temes clavats a hores d'ara{{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Temes clavats a hores d'ara{{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Fes que aquest tema aparegui al començament de tots els temes fins a","confirm_pin_globally":"Ja heu arribat a {{count}} temes afixats globalment. Massa temes afixats poden ser pesats per als usuaris nous o anònims. Esteu segur que voleu afixar un altre tema globalment?","unpin_globally":"Elimina aquest tema del començament de totes les llistes de temes.","unpin_globally_until":"Elimina aquest tema del començament de totes les llistes fins a \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Els mateixos usuaris poden desafixar el tema individualment.","not_pinned_globally":"No hi ha temes afixats globalment.","already_pinned_globally":{"one":"Temes actualment afixats globalment: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Temes actualment afixats globalment: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Converteix aquest tema en bàner que apareix al capdamunt de totes les pàgines.","remove_banner":"Elimina el bàner que apareix al capdamunt de totes les pàgines.","banner_note":"Els usuaris poden descartar el bàner tancant-lo. Només es pot posar un tema com a bàner en un moment donat.","no_banner_exists":"No hi ha tema com a bàner.","banner_exists":"A hores d'ara \u003cstrong class='badge badge-notification unread'\u003ehi ha\u003c/strong\u003e un tema com a bàner."},"inviting":"Convidant...","automatically_add_to_groups":"La invitació també inclou accés a aquests grups:","invite_private":{"title":"Convida al missatge","email_or_username":"Nom d'usuari o correu electrònic del convidat","email_or_username_placeholder":"correu electrònic o nom d'usuari","action":"Convida","success":"Hem convidat aquest usuari a participar en aquest missatge.","success_group":"Hem convidat aquest grup a participar en aquest missatge.","error":"Hi ha hagut un error en convidar aquest usuari.","group_name":"nom del grup"},"controls":"Controls del tema","invite_reply":{"title":"Convida","username_placeholder":"nom d'usuari","action":"Envia la invitació","help":"Convida altres a aquest tema per correu o amb notificacions.","to_forum":"Enviarem un breu correu electrònic al vostre contacte amb una autorització per a unir-s'hi immediatament en fer clic en un enllaç. No cal iniciar sessió.","sso_enabled":"Introduïu el nom d'usuari de la persona a qui voleu convidar a aquest tema.","to_topic_blank":"Escriviu el nom d'usuari o l'adreça electrònica de la persona a qui voleu convidar a aquest tema.","to_topic_email":"Heu introduït una adreça de correu electrònic. Us enviarem una invitació que permetrà al vostre contacte respondre immediatament a aquest tema.","to_topic_username":"Heu introduït un nom d'usuari. Li enviarem una notificació amb l'enllaç d'invitació a aquest tema.","to_username":"Introduïu el nom d'usuari de la persona a qui voleu convidar. Li enviarem una notificació amb l'enllaç d'invitació a aquest tema.","email_placeholder":"nom@exemple.com","success_email":"Hem enviat una invitació a \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Us notificarem quan s'accepti. Consulteu la pestanya d'invitacions de la vostra pàgina personal per a mantenir el seguiment de les invitacions.","success_username":"Hem convidat aquest usuari a participar en aquest tema.","error":"No hem pogut convidar aquesta persona. Potser ja ha estat convidada. (Les invitacions són restringides per freqüència.)","success_existing_email":"Ja existeix un usuari amb l'adreça \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Hem convidat aquest usuari a participar en aquest tema."},"login_reply":"Inicieu la sessió per a respondre","filters":{"n_posts":{"one":"%{count} publicació","other":"{{count}} publicacions"},"cancel":"Elimina filtre"},"move_to":{"title":"Mou a","action":"mou a","error":"Hi ha hagut un error movent publicacions."},"split_topic":{"title":"Mou a un tema nou","action":"mou a un tema nou","topic_name":"Títol del tema nou","radio_label":"Tema nou","error":"Hi ha hagut un error en moure publicacions a aquest tema nou.","instructions":{"one":"Esteu a punt de crear un tema nou i de difondre'l amb la publicació que heu triat.","other":"Esteu a punt de crear un tema nou i de difondre'l amb les \u003cb\u003e{{count}}\u003c/b\u003e publicacions que heu triat."}},"merge_topic":{"title":"Mou a un tema existent","action":"mou a un tema existent","error":"Hi ha hagut un error en moure publicacions a aquest tema.","radio_label":"Tema existent","instructions":{"one":"Trieu el tema al qual voldríeu moure aquesta publicació.","other":"Trieu el tema al qual voldríeu moure aquestes \u003cb\u003e{{count}}\u003c/b\u003e publicacions."}},"move_to_new_message":{"title":"Mou a missatge nou","action":"mou a missatge nou","message_title":"Títol del missatge nou","radio_label":"Missatge nou","participants":"Participants","instructions":{"one":"Esteu a punt de crear un missatge nou i omplir-lo amb la publicació que heu seleccionat.","other":"Esteu a punt de crear un missatge nou i omplir-lo amb les \u003cb\u003e{{count}}\u003c/b\u003e publicacions que heu seleccionat."}},"move_to_existing_message":{"title":"Mou a un missatge existent","action":"mou a un missatge existent","radio_label":"Missatge existent","participants":"Participants","instructions":{"one":"Trieu el missatge al qual voleu moure aquesta publicació.","other":"Trieu un missatge al qual voleu moure aquestes\u003cb\u003e{{count}}\u003c/b\u003e publicacions. "}},"merge_posts":{"title":"Combina les publicacions seleccionades","action":"combina les publicacions seleccionades","error":"Hi ha hagut un error en unir les publicacions seleccionades."},"change_owner":{"title":"Canvia el propietari","action":"canvia la propietat","error":"Hi ha hagut un error en canviar la propietat de les publicacions.","placeholder":"nom d'usuari del nou propietari","instructions":{"one":"Trieu un nou propietari per a la publicació de \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Trieu un nou propietari per a les {{count}} publicacions de \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Canvia la marca de temps","action":"canvia la marca de temps","invalid_timestamp":"La marca de temps no pot ser en el futur.","error":"Hi ha hagut un error en canviar la marca de temps del tema.","instructions":"Trieu la nova marca de temps del tema. Les publicacions del tema s'actualitzaran per a tenir la mateixa diferència de temps."},"multi_select":{"select":"selecciona","selected":"seleccionat ({{count}})","select_post":{"label":"selecciona","title":"Afegeix la publicació a la selecció"},"selected_post":{"label":"seleccionat","title":"Feu clic per a eliminar una publicació de la selecció"},"select_replies":{"label":"tria+respostes","title":"Afegeix una publicació i totes les seves respostes a la selecció"},"select_below":{"label":"selecciona +sota","title":"Afegeix una publicació i totes les següents a la selecció"},"delete":"suprimeix seleccionats","cancel":"cancel·la seleccionats","select_all":"selecciona-ho tot","deselect_all":"desmarca-ho tot","description":{"one":"Heu seleccionat \u003cb\u003e%{count}\u003c/b\u003e publicació","other":"Heu seleccionat \u003cb\u003e{{count}}\u003c/b\u003e publicacions."}},"deleted_by_author":{"one":"(tema abandonat per l'autor, serà suprimit automàticament en %{count}hora llevat que sigui senyalat amb bandera)","other":"(tema abandonat per l'autor, serà suprimit automàticament en %{count} hores llevat que sigui senyalat amb bandera)"}},"post":{"quote_reply":"Cita","edit_reason":"Motiu:","post_number":"publicació {{number}}","ignored":"Contingut ignorat","wiki_last_edited_on":"wiki editada per darrera vegada ","last_edited_on":"publicació editada per darrera vegada el","reply_as_new_topic":"Respon com a tema enllaçat","reply_as_new_private_message":"Respon amb un missatge nou als mateixos destinataris.","continue_discussion":"Continuant la discussió de {{postLink}}:","follow_quote":"vés a la publicació citada","show_full":"Mostra la publicació sencera","show_hidden":"Mira el contingut ignorat","deleted_by_author":{"one":"(publicació retirada per l'autor, se suprimirà automàticament en %{count} hora, si no és marcada amb bandera)","other":"(publicació retirada per l'autor, se suprimirà automàticament en %{count} hores, si no és marcada amb bandera)"},"collapse":"redueix","expand_collapse":"expandeix/contrau","locked":"un membre de l'equip responsable ha blocat l'edició d'aquesta publicació ","gap":{"one":"mostra %{count} resposta amagada","other":"mostra {{count}} respostes amagades"},"notice":{"new_user":"Aquesta és la primera vegada que {{user}} ha publicat: donem-li la benvinguda a la comunitat!","returning_user":"Fa un quant temps que no veiem {{user}}: la seva darrera publicació va ser {{time}}."},"unread":"Publicació no llegida","has_replies":{"one":"{{count}} resposta","other":"{{count}} respostes"},"has_likes_title":{"one":"La publicació agrada a %{count} persona","other":"La publicació agrada a {{count}} persones"},"has_likes_title_only_you":"us ha agradat aquesta publicació","has_likes_title_you":{"one":"La publicació us agrada a vós i a %{count} persona","other":"La publicació us agrada a vós i a {{count}} persones"},"errors":{"create":"S'ha produït un error en crear la vostra publicació. Torneu-ho a provar.","edit":"S'ha produït un error en editar la vostra publicació. Torneu-ho a provar.","upload":"Ho sentim. S'ha produït un error en carregar aquest fitxer. Torneu-ho a provar.","file_too_large":"Ho sentim, el fitxer és massa gros (mida màxima {{max_size_kb}} kb). Per què no pugeu el fitxer a un servei en el núvol i llavors enganxeu l'enllaç?","too_many_uploads":"Només podeu pujar un fitxer cada vegada.","too_many_dragged_and_dropped_files":"Ho sentim, només podeu pujar {{max}} fitxers de cop.","upload_not_authorized":"El fitxer que proveu de pujar no està autoritzat (les extensions autoritzades són: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Els usuaris nous no poden pujar imatges.","attachment_upload_not_allowed_for_new_user":"Els usuaris nous no poden adjuntar fitxers.","attachment_download_requires_login":"Heu d'iniciar la sessió per a descarregar fitxers adjunts."},"abandon_edit":{"confirm":"Esteu segur que voleu descartar els canvis?","no_value":"No, segueix","no_save_draft":"No, desa l'esborrany","yes_value":"Sí, descarta l'edició"},"abandon":{"confirm":"Esteu segur que voleu abandonar la vostra publicació?","no_value":"No, segueix","no_save_draft":"No, desa l'esborrany","yes_value":"Sí, abandona"},"via_email":"aquesta publicació ha arribat per correu electrònic","via_auto_generated_email":"aquesta publicació ha arribat per correu electrònic generat automàticament","whisper":"aquesta publicació és un xiuxiueig privat per a moderadors","wiki":{"about":"aquesta publicació és una wiki"},"archetypes":{"save":"Desa opcions"},"few_likes_left":"Gràcies per compartir l'amor! Us queden uns quants 'm'agrada' per donar avui.","controls":{"reply":"comença a redactar una resposta a aquesta publicació","like":"m'agrada aquesta publicació","has_liked":"us ha agradat aquesta publicació","read_indicator":"membres que han llegit aquesta publicació","undo_like":"desfés 'M'agrada'","edit":"edita aquesta publicació","edit_action":"Edita","edit_anonymous":"Ho sentim, però heu d'iniciar la sessió per a editar aquesta publicació.","flag":"posa bandera en privat a aquesta publicació per a destacar-la o envia una notificació privada sobre això","delete":"suprimeix aquesta publicació","undelete":"restaura aquesta publicació","share":"comparteix un enllaç sobre aquesta publicació","more":"Més","delete_replies":{"confirm":"També voleu suprimir les respostes a aquesta publicació?","direct_replies":{"one":"Sí, i %{count} resposta directa","other":"Sí, i {{count}} respostes directes."},"all_replies":{"one":"Sí, i %{count} resposta","other":"Sí, i totes les {{count}} respostes"},"just_the_post":"No, només aquesta publicació"},"admin":"accions d'administració de publicació","wiki":"Passa a wiki","unwiki":"Elimina la wiki","convert_to_moderator":"Afegeix un color de l'equip responsable","revert_to_regular":"Elimina el color de l'equip responsable","rebake":"Refés HTML","unhide":"Desfés amagar","change_owner":"Canvia la propietat","grant_badge":"Atorga insígnia","lock_post":"Bloca la publicació","lock_post_description":"impedeix que l'autor editi aquesta publicació","unlock_post":"Desbloca la publicació","unlock_post_description":"permet que l'autor editi aquesta publicació","delete_topic_disallowed_modal":"No teniu permís per a suprimir aquest tema. Si realment voleu que se suprimeixi, envieu una bandera perquè un moderador hi pari atenció juntament amb una argumentació.","delete_topic_disallowed":"no teniu permís per a suprimir aquest tema","delete_topic":"suprimeix el tema","add_post_notice":"Afegeix un avís a l'equip responsable","remove_post_notice":"Elimina l'avís a l'equip responsable","remove_timer":"elimina el temporitzador"},"actions":{"flag":"Bandera","defer_flags":{"one":"Ignora la bandera","other":"Ignora les banderes"},"undo":{"off_topic":"Desfés bandera","spam":"Desfés bandera","inappropriate":"Desfés bandera","bookmark":"Desfés preferit","like":"Desfés 'M'agrada'"},"people":{"off_topic":"marcat amb bandera de fora de context","spam":"marcat amb bandera com a brossa","inappropriate":"marcat amb bandera com a inapropiat","notify_moderators":"s'ha notificat els moderadors","notify_user":"ha enviat un missatge","bookmark":"marcat com a preferit","like":{"one":"ha fet 'M'agrada' ","other":"han fet 'M'agrada' "},"like_capped":{"one":"i {{count}}més han dit que els agrada","other":"i {{count}}més han dit que els agrada"}},"by_you":{"off_topic":"Ho heu marcat amb bandera de fora de context","spam":"Ho heu marcat amb bandera de brossa","inappropriate":"Ho heu marcat amb bandera d'inapropiat","notify_moderators":"Ho heu marcat amb bandera per a moderar","notify_user":"Heu enviat un missatge a aquest usuari.","bookmark":"Heu marcat aquesta publicació com a preferit","like":"Això us ha agradat"}},"delete":{"confirm":{"one":"Esteu segur que voleu suprimir aquesta publicació?","other":"Esteu segur que voleu suprimir aquestes {{count}} publicacions?"}},"merge":{"confirm":{"one":"Esteu segur que voleu combinar aquesta publicació?","other":"Esteu segur que voleu combinar aquests {{count}}missatges?"}},"revisions":{"controls":{"first":"Primera revisió","previous":"Revisió anterior","next":"Següent revisió","last":"Darrera revisió","hide":"Amaga la revisió","show":"Mostra la revisió","revert":"Reverteix a aquesta revisió","edit_wiki":"Edita Wiki","edit_post":"Edita publicació","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Mostra la sortida renderitzada amb afegits i eliminacions en línia","button":"HTML"},"side_by_side":{"title":"Mostra les diferències entre versions de costat ","button":"HTML"},"side_by_side_markdown":{"title":"Mostra de costat les diferències del codi en brut ","button":"En brut"}}},"raw_email":{"displays":{"raw":{"title":"Mostra el correu electrònic brut","button":"En brut"},"text_part":{"title":"Mostra la part de text del correu electrònic","button":"Text"},"html_part":{"title":"Mostra la part HTML del correu electrònic","button":"HTML"}}},"bookmarks":{"created":"Creat","name":"Nom"}},"category":{"can":"pot\u0026hellip; ","none":"(sense categoria)","all":"Totes les categories","choose":"categoria\u0026hellip;","edit":"Edita","edit_dialog_title":"Edita: %{categoryName}","view":"Mostra temes per categories","general":"General","settings":"Configuració","topic_template":"Plantilla de tema","tags":"Etiquetes","tags_allowed_tags":"Restringeix aquestes etiquetes per a aquesta categoria:","tags_allowed_tag_groups":"Restringeix aquests grups d'etiquetes a aquesta categoria:","tags_placeholder":"Llista (opcional) d'etiquetes permeses","tag_groups_placeholder":"Llista (opcional) d'etiquetes de grup permeses","manage_tag_groups_link":"Gestioneu els grups d'etiquetes aquí.","allow_global_tags_label":"Permet també altres etiquetes","tag_group_selector_placeholder":"(Opcional) Grup d’etiquetes","required_tag_group_description":"Requereix que els temes nous tinguin etiquetes d’un grup d’etiquetes:","min_tags_from_required_group_label":"Etiquetes num.:","required_tag_group_label":"Grup d'etiquetes:","topic_featured_link_allowed":"Permet enllaços destacats dins aquesta categoria","delete":"Suprimeix categoria","create":"Nova categoria","create_long":"Crea una categoria nova","save":"Desa la categoria","slug":"Slug de categoria","slug_placeholder":"(opcional) paraules amb guionets per a url","creation_error":"Hi ha hagut un error en crear aquesta categoria.","save_error":"Hi ha hagut un error en desar la categoria.","name":"Nom de la categoria","description":"Descripció","topic":"tema de la categoria","logo":"Imatge del logo de la categoria","background_image":"Imatge de fons de la categoria","badge_colors":"Colors d'insígnies","background_color":"Color de fons","foreground_color":"Color del primer pla","name_placeholder":"Una o dues paraules com a màxim","color_placeholder":"Qualsevol color web","delete_confirm":"Esteu segur que voleu suprimir aquesta categoria?","delete_error":"Hi ha hagut un error en suprimir aquesta categoria","list":"Llista les categories","no_description":"Introduïu una descripció per a aquesta categoria.","change_in_category_topic":"Edita la descripció","already_used":"Aquest color ha estat utilitzat per una altra categoria","security":"Seguretat","special_warning":"Atenció: aquesta és una categoria preconfigurada i no se'n pot editar la configuració de seguretat. Si no voleu fer servir aquesta categoria, suprimiu-la en comptes de reutilitzar-la.","uncategorized_security_warning":"Aquesta categoria és especial. Es tracta d'una àrea de manteniment per a temes que no tenen cap categoria; no pot tenir configuració de seguretat.","uncategorized_general_warning":"Aquesta categoria és especial. S'utilitza com a categoria per defecte per a temes nous que no tinguin una categoria seleccionada. Si voleu evitar aquest comportament i forçar la selecció de categories, \u003ca href=\"%{settingLink}\"\u003edesactiveu la configuració aquí\u003c/a\u003e. Si voleu canviar el nom o la descripció, aneu a \u003ca href=\"%{customizeLink}\"\u003ePersonalitza / Contingut de text\u003c/a\u003e .","pending_permission_change_alert":"No heu afegit %{group} a aquesta categoria; feu clic en aquest botó per a afegir-los.","images":"Imatges","email_in":"Adreça de correu electrònic entrant personalitzada:","email_in_allow_strangers":"Accepta missatges de correu d'usuaris anònims sense compte","email_in_disabled":"Les publicacions des del correu electrònic estan desactivades en les preferències del lloc web. Per a activar les publicacions des del correu electrònic, ","email_in_disabled_click":"activa l'opció \"email in\".","mailinglist_mirror":"Una categoria reflecteix una llista de correu","show_subcategory_list":"Mostra la llista de subcategories de temes en aquesta categoria. ","num_featured_topics":"Nombre de temes mostrats en la pàgina de categories:","subcategory_num_featured_topics":"Nombre de temes destacats en la pàgina de la categoria primària:","all_topics_wiki":"Converteix els temes nous en wikis per defecte","subcategory_list_style":"Estil de llista de la subcategoria:","sort_order":"Llista de temes ordenada per:","default_view":"Llista de temes per defecte:","default_top_period":"Període superior per defecte:","allow_badges_label":"Permet concedir insígnies dins aquesta categoria","edit_permissions":"Edita permisos","reviewable_by_group":"A més de l'equip responsable, les publicacions i les banderes en aquesta categoria també poden ser revisades per:","review_group_name":"nom del grup","require_topic_approval":"Requereix aprovació del moderador en tots els temes nous","require_reply_approval":"Requereix aprovació del moderador en totes les respostes noves","this_year":"enguany","position":"Posició en la pàgina de categories:","default_position":"Posició per defecte","position_disabled":"Les categories es mostraran per ordre d'activitat. Per a controlar l'ordre de les categories en llistes, ","position_disabled_click":"activeu la configuració \"posicions fixes de categories\"","minimum_required_tags":"Nombre mínim d'etiquetes necessari en un tema:","parent":"Categoria primària","num_auto_bump_daily":"Nombre de temes oberts que s'eleven automàticament cada dia:","navigate_to_first_post_after_read":"Navega fins a la primera publicació després de la lectura dels temes","notifications":{"watching":{"title":"Vigilant","description":"Vigilareu automàticament tots els temes en aquestes categories. Us notificarem de cada publicació nova en cada tema i us mostrarem un recompte de respostes noves."},"watching_first_post":{"title":"Vigilant la primera publicació","description":"Sereu notificat de temes nous en aquesta categoria però no de les respostes als temes."},"tracking":{"title":"Seguint","description":"Automàticament seguireu tots els temes nous en aquestes categories. Sereu notificat si algú us @menciona o us respon, i se us mostrarà un recompte de respostes noves."},"regular":{"title":"Normal","description":"Sereu notificat si algú us @menciona o us respon."},"muted":{"title":"Silenciat","description":"No us notificarem mai res sobre temes nous en aquestes categories i no apareixeran en més recents."}},"search_priority":{"label":"Prioritat de cerca","options":{"normal":"Normal","ignore":"Ignora","very_low":"Molt baixa","low":"Baixa","high":"Alta","very_high":"Molt alta"}},"sort_options":{"default":"per defecte","likes":"'M'agrada'","op_likes":"'M'agrada' a la publicació original","views":"Vistes","posts":"Publicacions","activity":"Activitat","posters":"Persones que han publicat","category":"Categoria","created":"Creat","votes":"Vots"},"sort_ascending":"Ascendent","sort_descending":"Descendent","subcategory_list_styles":{"rows":"Files","rows_with_featured_topics":"Files amb temes destacats","boxes":"Caixes","boxes_with_featured_topics":"Caixes amb temes destacats"},"settings_sections":{"general":"General","moderation":"Moderació","appearance":"Aparença","email":"Correu electrònic"}},"flagging":{"title":"Gràcies per ajudar a mantenir endreçada la comunitat!","action":"Marca la publicació amb bandera ","take_action":"Actua","notify_action":"Missatge","official_warning":"Avís oficial","delete_spammer":"Suprimeix generador de brossa","yes_delete_spammer":"Sí, suprimeix generador de brossa","ip_address_missing":"(N/A)","hidden_email_address":"(amagat)","submit_tooltip":"Envia la bandera privada","take_action_tooltip":"Arriba al límit de banderes immediatament, més que no pas esperar més banderes de la comunitat","cant":"Ara com ara no podeu marcar amb bandera aquesta publicació.","notify_staff":"Notifica l'equip responsable en privat","formatted_name":{"off_topic":"És fora de context.","inappropriate":"És inapropiat","spam":"És brossa"},"custom_placeholder_notify_user":"Especifica, amb ànim constructiu i sempre amb amabilitat.","custom_placeholder_notify_moderators":"Feu-nos saber què us amoïna i proporcioneu-nos tants enllaços rellevants i exemples com sigui possible.","custom_message":{"at_least":{"one":"introduïu almenys %{count} caràcter","other":"introduïu almenys {{count}} caràcters"},"more":{"one":"En falta només %{count} ","other":"En falten {{count}} "},"left":{"one":"%{count} restant","other":"{{count}} restants"}}},"flagging_topic":{"title":"Gràcies per ajudar a mantenir endreçada la comunitat!","action":"Marca el tema amb bandera ","notify_action":"Missatge"},"topic_map":{"title":"Resum del tema","participants_title":"Persones que han publicat sovint","links_title":"Enllaços populars","links_shown":"mostra més enllaços...","clicks":{"one":"%{count} clic","other":"%{count} clics"}},"post_links":{"about":"expandeix més enllaços per a aquesta publicació","title":{"one":"%{count} més","other":"%{count} més"}},"topic_statuses":{"warning":{"help":"Aquest és un avís oficial."},"bookmarked":{"help":"Heu marcat aquest tema com a preferit"},"locked":{"help":"Aquest tema està tancat; ja no s'hi accepten respostes noves"},"archived":{"help":"Aquest tema està arxivat; està congelat i no es pot canviar"},"locked_and_archived":{"help":"Aquest tema està tancat i arxivat; ja no s'hi accepten respostes noves i no es pot canviar"},"unpinned":{"title":"Desclavat","help":"Aquest tema és desafixat per a vós; es mostrarà en ordre normal."},"pinned_globally":{"title":"Afixat globalment","help":"Aquest tema està clavat globalment; es mostrarà al començament dels més recents i de la seva categoria."},"pinned":{"title":"Afixat","help":"Aquest tema està afixat per a vós; es mostrarà al capdamunt de la seva categoria"},"unlisted":{"help":"Aquest tema no és visible; no es mostrarà en la llista de temes i només és accessible amb un enllaç directe."},"personal_message":{"title":"Aquest tema és un missatge personal","help":"Aquest tema és un missatge personal"}},"posts":"Publicacions","posts_long":"hi ha {{number}} publicacions a aquest tema","original_post":"Publicació original","views":"Vistes","views_lowercase":{"one":"vista","other":"vistes"},"replies":"Respostes","views_long":{"one":"aquest tema ha estat vist %{count} vegada","other":"aquest tema ha estat vist {{number}} vegades"},"activity":"Activitat","likes":"'M'agrada'","likes_lowercase":{"one":"'M'agrada'","other":"'M'agrada'"},"likes_long":"aquest tema ha agradat {{number}} vegades","users":"Usuaris","users_lowercase":{"one":"usuari","other":"usuaris"},"category_title":"Categoria","history":"Historial","changed_by":"per {{author}}","raw_email":{"title":"Correu entrant","not_available":"No disponible!"},"categories_list":"Llista de categories","filters":{"with_topics":"%{filter} temes","with_category":"%{filter} %{category} temes","latest":{"title":"Més recents","title_with_count":{"one":"Darrer (%{count})","other":"Més recents ({{count}})"},"help":"temes amb publicacions recents"},"read":{"title":"Llegit","help":"temes que heu llegit, segons l'ordre de lectura"},"categories":{"title":"Categories","title_in":"Categoria - {{categoryName}}","help":"tots els temes agrupats per categoria"},"unread":{"title":"No llegits","title_with_count":{"one":"No llegit (%{count})","other":"No llegits ({{count}})"},"help":"temes que vigileu o seguiu amb publicacions no llegides","lower_title_with_count":{"one":"%{count} no llegit","other":"{{count}} no llegits"}},"new":{"lower_title_with_count":{"one":"%{count} nou","other":"{{count}} nous"},"lower_title":"nou","title":"Nous","title_with_count":{"one":"Nou (%{count})","other":"Nous ({{count}})"},"help":"temes creats durant els darrers dies"},"posted":{"title":"Les meves publicacions","help":"temes en què heu publicat"},"bookmarks":{"title":"Preferits","help":"temes que heu marcat com a preferits"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"temes més recents en la categoria {{categoryName}} "},"top":{"title":"Principals","help":"els temes més actius durant el darrer any, mes, setmana o dia","all":{"title":"Sempre"},"yearly":{"title":"Anualment"},"quarterly":{"title":"Trimestralment"},"monthly":{"title":"Mensualment"},"weekly":{"title":"Setmanalment"},"daily":{"title":"Diàriament"},"all_time":"Sempre","this_year":"Any","this_quarter":"Trimestre","this_month":"Mes","this_week":"Setmana","today":"Avui","other_periods":"mira dalt de tot"},"votes":{"title":"Vots","help":"temes amb més vots"}},"browser_update":"Malauradament, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eel vostre navegador és massa antic per a treballar amb aquest lloc web\u003c/a\u003e. \u003ca href=\"http://browsehappy.com\"\u003eActualitzeu el navegador\u003c/a\u003e.","permission_types":{"full":"Crea / Respon / Mira","create_post":"Respon / Mira","readonly":"Mira"},"lightbox":{"download":"descarrega","previous":"Anterior (tecla de fletxa esquerra)","next":"Següent (tecla de fletxa dreta)","counter":"%curr% de %total%","close":"Tanca (Esc)","content_load_error":"No s'ha pogut carregar \u003ca href=\"%url%\"\u003eel contingut\u003c/a\u003e. ","image_load_error":"No s'ha pogut carregar la \u003ca href=\"%url%\"\u003eimatge\u003c/a\u003e."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} o %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Dreceres de teclat","jump_to":{"title":"Salta a","home":"%{shortcut} Pàgina principal","latest":"%{shortcut} Més recents","new":"%{shortcut} Nous","unread":"%{shortcut} No llegits","categories":"%{shortcut} Categories","top":"%{shortcut} Principals","bookmarks":"%{shortcut} Preferits","profile":"%{shortcut} Perfil","messages":"%{shortcut} Missatges","drafts":"%{shortcut} Esborranys"},"navigation":{"title":"Navegació","jump":"%{shortcut} Vés a la publicació #","back":"%{shortcut} Enrere","up_down":"%{shortcut} Mou selecció \u0026uarr; \u0026darr;","open":"%{shortcut} Obre el tema seleccionat","next_prev":"%{shortcut} Secció següent/prèvia","go_to_unread_post":"%{shortcut} Vés a la primera publicació no llegida"},"application":{"title":"Aplicació","create":"%{shortcut} Crea un tema nou","notifications":"%{shortcut} Obre notificacions","hamburger_menu":"%{shortcut} Obre menú hamburguesa","user_profile_menu":"%{shortcut} Obre el menú usuari","show_incoming_updated_topics":"%{shortcut} Mostra temes actualitzats","search":"%{shortcut} Cerca","help":"%{shortcut} Obre l'ajuda de teclat","dismiss_new_posts":"%{shortcut} Descarta publicacions noves","dismiss_topics":"%{shortcut} Descarta temes","log_out":"%{shortcut} Tanca la sessió"},"composing":{"title":"Redactant","return":"%{shortcut} Torna a la redacció","fullscreen":"%{shortcut} Redacció a pantalla completa"},"actions":{"title":"Accions","bookmark_topic":"%{shortcut} Canvia de tema preferit","pin_unpin_topic":"%{shortcut} Clava/Desclava tema","share_topic":"%{shortcut} Comparteix el tema","share_post":"%{shortcut} Comparteix publicació","reply_as_new_topic":"%{shortcut} Respon com a tema enllaçat","reply_topic":"%{shortcut} Respon al tema","reply_post":"%{shortcut} Respon a la publicació","quote_post":"%{shortcut} Cita la publicació","like":"%{shortcut} M'agrada la publicació","flag":"%{shortcut} Marca la publicació amb bandera","bookmark":"%{shortcut} Marca la publicació com a preferit","edit":"%{shortcut} Edita la publicació","delete":"%{shortcut} Suprimeix la publicació","mark_muted":"%{shortcut} Silencia el tema","mark_regular":"%{shortcut} Tema normal (per defecte)","mark_tracking":"%{shortcut} Segueix el tema","mark_watching":"%{shortcut} Vigila el tema","print":"%{shortcut} Imprimeix el tema","defer":"%{shortcut} Ajorna el tema"}},"badges":{"earned_n_times":{"one":"Ha rebut aquesta insígnia %{count} vegada.","other":"Ha rebut aquesta insígnia%{count} vegades."},"granted_on":"Concedit %{date}","others_count":"Altres amb aquesta insígnia (%{count})","title":"Insígnies","allow_title":"Podeu fer servir aquesta insígnia com a títol","multiple_grant":"Podeu guanyar-la diverses vegades","badge_count":{"one":"%{count} insígnia","other":"%{count} insígnies"},"more_badges":{"one":"+%{count} Més","other":"+%{count} Més"},"granted":{"one":"%{count} concedit","other":"%{count} concedits"},"select_badge_for_title":"Trieu una insígnia per a fer-la servir com a títol vostre","none":"(cap)","successfully_granted":"S'ha concedit amb èxit %{badge} a %{username}","badge_grouping":{"getting_started":{"name":"Començant"},"community":{"name":"Comunitat"},"trust_level":{"name":"Nivell de confiança"},"other":{"name":"Altres"},"posting":{"name":"Publicant"}}},"tagging":{"all_tags":"Totes les etiquetes","other_tags":"Altres etiquetes","selector_all_tags":"totes les etiquetes","selector_no_tags":"sense etiquetes","changed":"etiquetes canviades:","tags":"Etiquetes","choose_for_topic":"etiquetes opcionals","add_synonyms":"Afegeix","delete_tag":"Suprimeix l'etiqueta","delete_confirm":{"one":"Esteu segur que voleu suprimir aquesta etiqueta i eliminar-la del tema %{count} al qual és assignada?","other":"Esteu segur que voleu suprimir aquesta etiqueta i eliminar-la dels {{count}} temes als quals és assignada?"},"delete_confirm_no_topics":"Esteu segur que voleu suprimir aquesta etiqueta?","rename_tag":"Reanomena l'etiqueta","rename_instructions":"Trieu un nom nou per a l'etiqueta:","sort_by":"Ordena per:","sort_by_count":"comptabilitza","sort_by_name":"nom","manage_groups":"Gestiona grups d'etiquetes","manage_groups_description":"Defineix grups per a organitzar etiquetes","upload":"Carrega etiquetes","upload_description":"Carregueu un fitxer CSV per a crear etiquetes a l'engròs","upload_instructions":"Una per línia, opcionalment amb un grup d'etiquetes en el format 'tag_name,tag_group'.","upload_successful":"S'han carregat les etiquetes correctament","delete_unused_confirmation":{"one":"Se suprimirà %{count} etiqueta: %{tags}","other":"Se suprimiran %{count}etiquetes: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} i %{count} més","other":"%{tags} i %{count} més"},"delete_unused":"Suprimeix etiquetes no utilitzades","delete_unused_description":"Suprimeix totes les etiquetes que no estiguin lligades a cap tema o missatge personal","cancel_delete_unused":"Cancel·la","filters":{"without_category":"%{filter} %{tag} temes","with_category":"%{filter} %{tag} temes en %{category}","untagged_without_category":"%{filter} temes sense etiquetar","untagged_with_category":"%{filter} temes sense etiquetar en %{category}"},"notifications":{"watching":{"title":"Vigilant","description":"Vigilareu automàticament tots els temes amb aquesta etiqueta. Sereu notificat de totes les noves publicacions i temes; a més, el recompte de publicacions no llegides i noves també apareixerà a la vora del tema."},"watching_first_post":{"title":"Vigilant la primera publicació","description":"Sereu notificat de temes nous amb aquesta etiqueta, però no de respostes als temes."},"tracking":{"title":"Seguint","description":"Seguireu automàticament tots els temes amb aquesta etiqueta. A la vora del tema apareixerà un recompte de publicacions no llegides i noves."},"regular":{"title":"Habitual","description":"Rebreu alertes si una persona menciona el vostre @nom o respon a la vostra publicació."},"muted":{"title":"Silenciat","description":"No sereu notificat de res sobre temes nous amb aquesta etiqueta, i no apareixeran en la pestanya de no llegits."}},"groups":{"title":"Grups d'etiquetes","about":"Afegeix etiquetes a grups per a gestionar-los més fàcilment.","new":"Nou grup","tags_label":"Etiquetes en aquest grup:","tags_placeholder":"etiquetes","parent_tag_label":"Etiqueta primària:","parent_tag_placeholder":"Opcional","parent_tag_description":"Les etiquetes d'aquest grup no es poden fer servir si no hi és l'etiqueta primària.","one_per_topic_label":"Limita a una etiqueta per cada tema d'aquest grup","new_name":"Nou grup d'etiquetes","name_placeholder":"Nom del grup d’etiquetes","save":"Desa","delete":"Suprimeix","confirm_delete":"Esteu segur que voleu suprimir aquest grup d'etiquetes?","everyone_can_use":"Etiquetes que poden ser utilitzades per tothom","usable_only_by_staff":"Les etiquetes són visibles per a tothom, però sols l'equip responsable pot fer-les servir.","visible_only_to_staff":"Les etiquetes són visibles sols per a l'equip responsable"},"topics":{"none":{"unread":"No teniu temes no llegits.","new":"No teniu temes nous.","read":"Encara no heu llegit cap tema.","posted":"Encara no heu publicat cap tema.","latest":"No hi ha temes recents.","bookmarks":"Encara no heu marcat temes com a preferits.","top":"No hi ha temes principals."},"bottom":{"latest":"No hi ha més temes recents.","posted":"No hi ha més temes publicats.","read":"No hi ha més temes llegits.","new":"No hi ha més temes nous.","unread":"No hi ha més temes sense llegir.","top":"No hi ha més temes principals.","bookmarks":"No hi ha més temes marcats com a preferits."}}},"invite":{"custom_message":"Feu que la invitació tingui un toc personal escrivint un \u003ca href\u003emissatge personalitzat\u003c/a\u003e.","custom_message_placeholder":"Introduïu el vostre missatge personalitzat","custom_message_template_forum":"Ep! Hauríeu d'unir-vos a aquest fòrum!","custom_message_template_topic":"Ep! Crec que us pot agradar aquest tema!"},"forced_anonymous":"A causa de la càrrega extrema, això es mostra temporalment a tothom com ho veuria un usuari que no ha iniciat sessió.","safe_mode":{"enabled":"El mode segur està activat. Per a sortir-ne tanqueu aquesta finestra del navegador."},"poll":{"voters":{"one":"votant","other":"votants"},"total_votes":{"one":"vot total","other":"vots totals"},"average_rating":"Classificació mitjana: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Els vots són \u003cstrong\u003epúblics\u003c/strong\u003e."},"results":{"vote":{"title":"Els resultats es mostraran en \u003cstrong\u003evotació\u003c/strong\u003e ."},"closed":{"title":"Els resultats es mostraran una vegada \u003cstrong\u003etancada\u003c/strong\u003e la votació."},"staff":{"title":"Els resultats només es mostren als membres de l'\u003cstrong\u003eequip responsable\u003c/strong\u003e."}},"multiple":{"help":{"at_least_min_options":{"one":"Trieu com a mínim \u003cstrong\u003e%{count}\u003c/strong\u003e opció","other":"Trieu com a mínim \u003cstrong\u003e%{count}\u003c/strong\u003e opcions"},"up_to_max_options":{"one":"Trieu fins a \u003cstrong\u003e%{count}\u003c/strong\u003e opció","other":"Trieu fins a \u003cstrong\u003e%{count}\u003c/strong\u003e opcions"},"x_options":{"one":"Trieu \u003cstrong\u003e%{count}\u003c/strong\u003e opció","other":"Trieu \u003cstrong\u003e%{count}\u003c/strong\u003e opcions"},"between_min_and_max_options":"Trieu entre \u003cstrong\u003e%{min}\u003c/strong\u003e i \u003cstrong\u003e%{max}\u003c/strong\u003e opcions"}},"cast-votes":{"title":"Repartiu els vostres vots","label":"Voteu ara!"},"show-results":{"title":"Mostra els resultats de l'enquesta","label":"Mostra els resultats"},"hide-results":{"title":"Torna als vots","label":"Mostra el vot"},"group-results":{"title":"Agrupa els vots per camp d'usuari"},"ungroup-results":{"title":"Combina tots els vots"},"export-results":{"title":"Exporta els resultats de la votació","label":"Exporta"},"open":{"title":"Obre l'enquesta","label":"Obre","confirm":"Esteu segur que voleu obrir aquesta enquesta?"},"close":{"title":"Tanca l'enquesta","label":"Tanca","confirm":"Esteu segur que voleu tancar aquesta enquesta?"},"automatic_close":{"closes_in":"Es tanca en \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e .","age":"Tancat \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Ho sentim. S'ha produït un error en canviar l'estat d'aquesta enquesta.","error_while_casting_votes":"Ho sentim. S'ha produït un error en l'emissió dels vostres vots.","error_while_fetching_voters":"Hi ha hagut un error en mostrar els votants.","error_while_exporting_results":"S'ha produït un error en exportar els resultats de la votació.","ui_builder":{"title":"Crea una enquesta","insert":"Insereix una enquesta","help":{"options_count":"Introduïu almenys una opció","invalid_values":"El valor mínim ha de ser més petit que el valor màxim.","min_step_value":"L'increment mínim és 1"},"poll_type":{"label":"Tipus","regular":"Elecció simple","multiple":"Elecció múltiple","number":"Valoració numèrica"},"poll_result":{"label":"Resultats","always":"Sempre visible","vote":"En votació","closed":"Quan estigui tancada","staff":"Només l'equip responsable"},"poll_chart_type":{"label":"Tipus de gràfic"},"poll_config":{"max":"Màxim","min":"Mínim","step":"Pas"},"poll_public":{"label":"Mostra qui ha votat"},"poll_options":{"label":"Introduïu una opció d'enquesta per línia"},"automatic_close":{"label":"Tanca automàticament l'enquesta"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Inicia el tutorial d'usuari nou per a tots els usuaris nous.","welcome_message":"Envia a tots els usuaris nous un missatge de benvinguda amb una guia ràpida d'iniciació."}},"discourse_local_dates":{"relative_dates":{"today":"Avui %{time}","tomorrow":"Demà %{time}","yesterday":"Ahir %{time}","countdown":{"passed":"la data ha passat"}},"title":"Inseriu la data i l'hora","create":{"form":{"insert":"Insereix","advanced_mode":"Mode avançat","simple_mode":"Mode simple","format_description":"Format usat per a mostrar la data a l'usuari. Utilitzeu \"\\T\\Z\" per a mostrar la zona horària de l'usuari en paraules (ex. Europa/París)","timezones_title":"Zones horàries que s'han de mostrar","timezones_description":"Les zones horàries es faran servir per a mostrar les dates en previsualització i recurs (fallback).","recurring_title":"Recurrència","recurring_description":"Defineix la recurrència d'un esdeveniment. També podeu editar manualment l'opció recurrent generada pel formulari i utilitzar una de les claus següents: anys, trimestres, mesos, setmanes, dies, hores, minuts, segons i mil·lisegons.","recurring_none":"Sense recurrència","invalid_date":"La data no és vàlida. Assegureu-vos que la data i l'hora són correctes","date_title":"Data","time_title":"Hora","format_title":"Format de data","timezone":"Zona horària","until":"Fins a...","recurring":{"every_day":"Cada dia","every_week":"Cada setmana","every_two_weeks":"Cada dues setmanes","every_month":"Cada mes","every_two_months":"Cada dos mesos","every_three_months":"Cada tres mesos","every_six_months":"Cada sis mesos","every_year":"Cada any"}}}},"details":{"title":"Amaga els detalls"},"presence":{"replying":"responent","editing":"editant","replying_to_topic":{"one":"responent","other":"responent"}},"voting":{"title":"Votació","reached_limit":"Us heu quedat sense vots. Elimineu un vot existent.","list_votes":"Llista els vots","votes_nav_help":"temes amb més vots","voted":"Heu votat sobre aquest tema","allow_topic_voting":"Permet als usuaris votar sobre temes d'aquesta categoria","vote_title":"Vota","vote_title_plural":"Vots","voted_title":"Votat","voting_closed_title":"Tancat","voting_limit":"Límit","votes_left":{"one":"Us queda {{count}} vot. Mireu els \u003ca href='{{path}}'\u003evostres vots\u003c/a\u003e.","other":"Us queden {{count}} vots. Mireu els \u003ca href='{{path}}'\u003evostres vots\u003c/a\u003e."},"votes":{"one":"{{count}} vot","other":"{{count}} vots"},"anonymous_button":{"one":"Vota","other":"Vots"},"remove_vote":"Elimina el vot"},"adplugin":{"advertisement_label":"PUBLICITAT"}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","next_business_day":"下一个工作日","start_of_next_business_week":"下周一","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"choose_message":{"title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"user":{"website":"网站"}},"directory":{"last_updated":"最近更新："},"groups":{"confirm_leave":"你确定要离开这个群组吗？"},"user":{"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","featured_topic":"精选主题","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor":{"totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"name_required_error":"你必须提供安全密钥的名称。"}},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"}},"modal":{"dismiss_error":"忽略错误"},"select_kit":{"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"composer":{"composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","membership_request_consolidated":"新的成员申请"}},"search":{"advanced":{"filters":{"created":"我创建的"},"statuses":{"public":"是公开的"}}},"topic":{"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"actions":{"people":{"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。"},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"}},"poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"}},"group-results":{"label":"显示错误"},"ungroup-results":{"label":"隐藏错误"},"ui_builder":{"poll_groups":{"label":"允许的群组"}}},"docker":{"upgrade":"当前使用 Discourse 的旧版本。","perform_upgrade":"点击这里升级。"}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"},"actions":{"people":{"read":{"one":"read this"},"read_capped":{"one":"and {{count}} other read this"}}}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'ca';
I18n.pluralizationRules.ca = MessageFormat.locale.ca;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var ca = moment.defineLocale('ca', {
        months : {
            standalone: 'gener_febrer_març_abril_maig_juny_juliol_agost_setembre_octubre_novembre_desembre'.split('_'),
            format: 'de gener_de febrer_de març_d\'abril_de maig_de juny_de juliol_d\'agost_de setembre_d\'octubre_de novembre_de desembre'.split('_'),
            isFormat: /D[oD]?(\s)+MMMM/
        },
        monthsShort : 'gen._febr._març_abr._maig_juny_jul._ag._set._oct._nov._des.'.split('_'),
        monthsParseExact : true,
        weekdays : 'diumenge_dilluns_dimarts_dimecres_dijous_divendres_dissabte'.split('_'),
        weekdaysShort : 'dg._dl._dt._dc._dj._dv._ds.'.split('_'),
        weekdaysMin : 'dg_dl_dt_dc_dj_dv_ds'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM [de] YYYY',
            ll : 'D MMM YYYY',
            LLL : 'D MMMM [de] YYYY [a les] H:mm',
            lll : 'D MMM YYYY, H:mm',
            LLLL : 'dddd D MMMM [de] YYYY [a les] H:mm',
            llll : 'ddd D MMM YYYY, H:mm'
        },
        calendar : {
            sameDay : function () {
                return '[avui a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
            },
            nextDay : function () {
                return '[demà a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
            },
            nextWeek : function () {
                return 'dddd [a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
            },
            lastDay : function () {
                return '[ahir a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
            },
            lastWeek : function () {
                return '[el] dddd [passat a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
            },
            sameElse : 'L'
        },
        relativeTime : {
            future : 'd\'aquí %s',
            past : 'fa %s',
            s : 'uns segons',
            ss : '%d segons',
            m : 'un minut',
            mm : '%d minuts',
            h : 'una hora',
            hh : '%d hores',
            d : 'un dia',
            dd : '%d dies',
            M : 'un mes',
            MM : '%d mesos',
            y : 'un any',
            yy : '%d anys'
        },
        dayOfMonthOrdinalParse: /\d{1,2}(r|n|t|è|a)/,
        ordinal : function (number, period) {
            var output = (number === 1) ? 'r' :
                (number === 2) ? 'n' :
                (number === 3) ? 'r' :
                (number === 4) ? 't' : 'è';
            if (period === 'w' || period === 'W') {
                output = 'a';
            }
            return number + output;
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return ca;

})));

// moment-timezone-localization for lang code: ca

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Alger","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Caire, el","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Djibouti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Al-aaiun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Khartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lome","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Muqdiisho","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndjamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Trípoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaína","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Río Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucumán","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahía de Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belém","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogotà","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancun","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Caiena","id":"America/Cayenne"},{"value":"America/Cayman","name":"Caiman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiabá","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepé","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaica","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceió","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinica","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlán","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Mérida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Ciutat de Mèxic","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"Nova York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Dakota del Nord","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Dakota del Nord","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Dakota del Nord","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panamà","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Puerto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Río Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarém","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Scoresbysund","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Saint John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Saint Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Saint Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Saint Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Saint Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr’","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aqtaū","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aqtobe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ashgabat","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atirau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrain","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Bakú","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beirut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bixkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Calcuta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Txità","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Choibalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damasc","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dacca","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dushanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hong Kong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Jakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jaipur","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jerusalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kābul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamtxatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandú","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Khandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnoiarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuwait","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macau","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makasar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Masqat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicòsia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pyongyang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Qatar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kizil-Orda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Yangôn","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Al-Riyād","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Chi Minh","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sakhalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarcanda","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seül","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Xangai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapur","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolimsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taixkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimbu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tòquio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulan Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumchi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust’-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Erevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Açores","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermudes","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Illes Canàries","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Cap Verd","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Illes Fèroe","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Geòrgia del Sud","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Saint Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Temps universal coordinat","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrakhan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Atenes","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrad","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlín","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Brussel·les","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bucarest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chisinau","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Copenhagen","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Hora estàndard d’IrlandaDublín","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Hèlsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kíev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisboa","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Hora d’estiu britànicaLondres","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxemburg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Maarianhamina","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Mònaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moscou","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"París","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praga","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Roma","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saràtov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Estocolm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uliànovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Uzhgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vaticà","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Viena","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vílnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varsòvia","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporíjia","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zuric","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Christmas","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comoro","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahe","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldives","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Maurici","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Reunió","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Illa de Pasqua","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fiji","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galápagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marqueses","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Nouméa","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahití","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
