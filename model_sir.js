//States that are used in the model
//Colours: https://lshtm.sharepoint.com/Services/comms-eng/Documents/lshtm-brand-guidelines.pdf
let model_states = [
  {name: "Susceptible", var: "S", colour: 'rgb(0, 191, 111)', init: 100000, min: 1, max: 20000000, step: 1, show_state: true, epitype: "prevalence", yaxis: "left"}, //lightgreen
  {name: "Infectious", var: "I", colour: 'rgb(255, 184, 28)', init: 1, min: 1, max: 20000000, step: 1, show_state: true, epitype: "prevalence", yaxis: "left"}, //yellow
  {name: "Recovered", var: "R", colour: 'rgb(0, 174, 199)', init: 0, min: 0, max: 20000000, step: 1, show_state: true, epitype: "prevalence", yaxis: "left"}, //blue
  {name: "Incidence", var: "Ii", colour: 'rgb(75, 0, 45)', init: 0, min: 0, max: 0, show_state: true, hide_input: true, epitype: "incidence", main_state: "I", yaxis: "left"}, //purple
  {name: "Reproduction number", var: "Rt", colour: 'rgb(75, 0, 45)', init: 1, min: 0, max: 0, show_state: true, hide_input: true, epitype: "prevalence", yaxis: "right", nopercentage: true} //purple
];

//All input parameters that are used in the model
//init is the initial value
//adj specifies how value should be adjusted if timestep != 1 (* or /), leave blank for no adjustment
let model_parameters = [
  //{name: "Average number of (direct) contacts per day", var: "contacts", init: 6, adj: "/", min: 0.1, max: 50, type: "range"},
  {name: "Average number of (direct) contacts per day", var: "contacts", init: 5, adj: "/", min: 0.1, step: 0.1, max: 50},
  {name: "Probability of transmission for each contact", var: "probtrans", init: 0.15, adj: "", min: 1/1000, step: 0.05, max: 1},
  {name: "Average duration of infectiousness (in days)", var: "dur_inf", init: 4, adj: "*", min: 0.25, step: 0.5,  max: 365},
  {name: "Average life expectancy (in years)", var: "lexp", init: 70, adj: "*", min: 10, step: 1, max: 120},
];

//All configuration options used in the model
let model_configuration = [
  {name: "Total number of years to model", var: "model_years", init: 0.5, min: 1/12, max: 100, step: 0.5, rerun: true},
  {name: "Skip years in plot", var: "model_plot_start_year", init: 0, min: 0, max: 100, rerun: false},
  {name: "Number of modelled timesteps per day", var: "model_day_timesteps", init: 4, min: 1, max: 8, rerun: true},
  {name: "Number of modelled days that are saved", var: "model_save_days", init: 1, min: 1, max: 365, rerun: true},
  {name: "Plot output type", var: "model_plot_output", init: "prevalence", options: ["prevalence", "incidence", "incidence_cum"], rerun: false, type: "radio"},
  {name: "Show output as", var: "model_plot_percentage", init: "percentage", options: ["percentage", "absolute"], rerun: false, type: "radio"},
  {name: "Model type", var: "model_deterministic", init: "deterministic", options: ["deterministic", "stochastic"], rerun: true, type: "radio"},
  {name: "Number of model runs (if stochastic)", var: "model_runs", init: 1, min: 1, max: 10, rerun: true},
];

//Run one timestep of the model
function updateState(t, deterministic, reported){
  if(reported) this.state_current.Ii = 0.0;

  let S = this.state_current.S;
  let I = this.state_current.I;
  let R = this.state_current.R;
  let N = S + I + R;

  let Rt = this.summary.R0 * (S/N);

  //Note, need to convert these rates to risks
  var lambda = this.params.contacts * this.params.probtrans * (I / N);
  var gamma = 1.0/this.params.dur_inf;
  var delta = 1.0/(this.params.lexp * 365.25);

  lambda = 1.0 - Math.exp(-lambda);
  gamma = 1.0 - Math.exp(-gamma);
  delta = 1.0 - Math.exp(-delta);

  //Assign variables for cleaner notation
  var [dS, dI, dR] = [0.0, 0.0, 0.0];
  var [S_I, I_R] = [0.0, 0.0];

  //Transmissions and transitions
  S_I = (deterministic ? (S * lambda) : (this.rbinom(S, lambda)));
  I_R = (deterministic ? (I * gamma) : (this.rbinom(I, gamma)));

  //Difference equations
  dS = -S_I +delta*(N - S);
  dI = S_I -I_R -delta*I;
  dR = I_R -delta*R;

  //Update states
  this.state_current.S += dS;
  this.state_current.I += dI;
  this.state_current.R += dR;
  this.state_current.Ii += S_I; //Note, sum incidence until reported
  this.state_current.Rt = Rt; //Update Rt at every timestep
}

function calculateR0(){
  let R0 = this.params.contacts * this.params.probtrans * this.params.dur_inf;
  this.summary.R0 = R0;
}

let testmodel = new TransmissionModel(model_states, model_parameters, updateState, calculateR0, "model", model_configuration);
